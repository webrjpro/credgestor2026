const statsRepository = require('../repositories/stats.repository');

const DEFAULT_TENANT = 'default';

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
}

async function getAggregates(tenantId) {
  const safeTenant = normalizeTenantId(tenantId);

  const clientesTotal = statsRepository.getClientesTotal(safeTenant);
  const clientesAtivos = statsRepository.getClientesAtivos(safeTenant);
  const clientesBlacklist = statsRepository.getClientesBlacklist(safeTenant);

  const empTotal = statsRepository.getEmprestimosTotal(safeTenant);
  const empAtivos = statsRepository.getEmprestimosAtivos(safeTenant);
  const empFinalizados = statsRepository.getEmprestimosQuitados(safeTenant);

  const agrFinanc = statsRepository.getFinanceiroAtivos(safeTenant);
  const caixaSaldo = statsRepository.getCaixaSaldo(safeTenant);

  const tiposRows = statsRepository.getAtivosPorTipo(safeTenant);
  const ativosPorTipo = {};
  for (const r of tiposRows) {
    ativosPorTipo[String(r.tipo || 'avulso').toLowerCase()] = r.c;
  }

  const novos7 = statsRepository.getNovosClientes7Dias(safeTenant);

  return {
    clientes: {
      total: clientesTotal,
      ativos: clientesAtivos,
      blacklist: clientesBlacklist,
    },
    emprestimos: {
      total: empTotal,
      ativos: empAtivos,
      finalizados: empFinalizados,
    },
    financeiro: {
      totalEmprestado: Number(agrFinanc.totalEmprestado) || 0,
      totalValorContratos: Number(agrFinanc.totalValorContratos) || 0,
      caixaSaldo,
    },
    top: {
      novosUltimos7dias: novos7,
      ativosPorTipo,
    },
  };
}

async function getDashboardStats(tenantId) {
  const safeTenant = normalizeTenantId(tenantId);

  const totalClientes = statsRepository.getClientesTotal(safeTenant);
  const totalEmprestimos = statsRepository.getEmprestimosTotal(safeTenant);

  const porStatus = statsRepository.getEmprestimosPorStatus(safeTenant);
  const statusMap = {};
  for (const s of porStatus) {
    statusMap[s.status] = { count: s.count, total: s.total };
  }

  const totalEntradas = statsRepository.getTransacoesTotalPorTipo('entrada', safeTenant);
  const totalSaidas = statsRepository.getTransacoesTotalPorTipo('saida', safeTenant);

  const caixaSaldo = statsRepository.getCaixaSaldo(safeTenant);

  const hoje = new Date().toISOString().split('T')[0];
  const seteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const aVencer = statsRepository.getEmprestimosAVencer(hoje, seteDias, safeTenant);
  const atrasados = statsRepository.getEmprestimosAtrasados(hoje, safeTenant);
  const topClientes = statsRepository.getTopClientes(safeTenant);

  const totalFinalizados = statsRepository.getEmprestimosFinalizadosCount(safeTenant);
  const inadimplentes = statusMap.atrasado?.count || 0;
  const taxaInadimplencia = totalFinalizados > 0
    ? Math.round((inadimplentes / totalFinalizados) * 10000) / 100
    : 0;

  return {
    clientes: { total: totalClientes },
    emprestimos: {
      total: totalEmprestimos,
      por_status: statusMap,
      a_vencer: aVencer,
      atrasados,
    },
    financeiro: {
      saldo: caixaSaldo,
      total_entradas: totalEntradas,
      total_saidas: totalSaidas,
      lucro: totalEntradas - totalSaidas,
      taxa_inadimplencia: taxaInadimplencia,
    },
    top_clientes: topClientes,
  };
}

async function getCharts(tenantId) {
  const safeTenant = normalizeTenantId(tenantId);

  const emprestimosMensal = statsRepository.getEmprestimosMensalUltimos12Meses(safeTenant);
  const fluxoMensal = statsRepository.getFluxoMensalUltimos12Meses(safeTenant);

  const meses = new Set();
  emprestimosMensal.forEach(e => meses.add(e.mes));
  fluxoMensal.forEach(e => meses.add(e.mes));
  const labels = [...meses].sort();

  const empMap = {};
  emprestimosMensal.forEach(e => { empMap[e.mes] = e; });

  const fluxoMap = {};
  fluxoMensal.forEach(e => {
    if (!fluxoMap[e.mes]) fluxoMap[e.mes] = {};
    fluxoMap[e.mes][e.tipo] = e.total;
  });

  return {
    labels,
    emprestimos: {
      quantidade: labels.map(m => empMap[m]?.quantidade || 0),
      valor: labels.map(m => empMap[m]?.valor_total || 0),
    },
    fluxo: {
      entradas: labels.map(m => fluxoMap[m]?.entrada || 0),
      saidas: labels.map(m => fluxoMap[m]?.saida || 0),
      lucro: labels.map(m => (fluxoMap[m]?.entrada || 0) - (fluxoMap[m]?.saida || 0)),
    },
  };
}

module.exports = {
  getAggregates,
  getDashboardStats,
  getCharts,
};
