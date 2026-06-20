const { queryOne, queryAll } = require('../database');

function getClientesTotal(tenantId) {
  return queryOne('SELECT COUNT(*) as c FROM clientes WHERE tenant_id = ?', [tenantId])?.c || 0;
}

function getClientesAtivos(tenantId) {
  return queryOne("SELECT COUNT(*) AS c FROM clientes WHERE status = 'ativo' AND tenant_id = ?", [tenantId])?.c || 0;
}

function getClientesBlacklist(tenantId) {
  return queryOne("SELECT COUNT(*) AS c FROM clientes WHERE blacklist = 1 AND tenant_id = ?", [tenantId])?.c || 0;
}

function getEmprestimosTotal(tenantId) {
  return queryOne('SELECT COUNT(*) AS c FROM emprestimos WHERE tenant_id = ?', [tenantId])?.c || 0;
}

function getEmprestimosAtivos(tenantId) {
  return queryOne("SELECT COUNT(*) AS c FROM emprestimos WHERE status = 'ativo' AND tenant_id = ?", [tenantId])?.c || 0;
}

function getEmprestimosQuitados(tenantId) {
  return queryOne("SELECT COUNT(*) AS c FROM emprestimos WHERE status = 'quitado' AND tenant_id = ?", [tenantId])?.c || 0;
}

function getFinanceiroAtivos(tenantId) {
  return queryOne(`
    SELECT
      COALESCE(SUM(valor), 0)      AS totalEmprestado,
      COALESCE(SUM(valor_parcela * parcelas), 0) AS totalValorContratos
    FROM emprestimos
    WHERE status = 'ativo' AND tenant_id = ?
  `, [tenantId]) || { totalEmprestado: 0, totalValorContratos: 0 };
}

function getCaixaSaldo(tenantId) {
  const row = queryOne('SELECT saldo FROM caixa WHERE tenant_id = ?', [tenantId]);
  return row ? Number(row.saldo) || 0 : 0;
}

function getAtivosPorTipo(tenantId) {
  return queryAll(`
    SELECT tipo, COUNT(*) AS c FROM emprestimos
    WHERE status = 'ativo' AND tenant_id = ?
    GROUP BY tipo
  `, [tenantId]);
}

function getNovosClientes7Dias(tenantId) {
  return queryOne(`
    SELECT COUNT(*) AS c FROM clientes
    WHERE date(data_cadastro) >= date('now', '-7 days') AND tenant_id = ?
  `, [tenantId])?.c || 0;
}

function getEmprestimosPorStatus(tenantId) {
  return queryAll(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(valor), 0) as total
     FROM emprestimos WHERE tenant_id = ?
     GROUP BY status`,
    [tenantId]
  );
}

function getTransacoesTotalPorTipo(tipo, tenantId) {
  return queryOne(
    `SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND tenant_id = ?`,
    [tipo, tenantId]
  )?.total || 0;
}

function getEmprestimosAVencer(hoje, seteDias, tenantId) {
  return queryAll(
    `SELECT e.id, e.valor, e.data_vencimento, e.taxa, c.nome as cliente_nome
     FROM emprestimos e LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE e.status = 'ativo' AND e.data_vencimento BETWEEN ? AND ? AND e.tenant_id = ?
     ORDER BY e.data_vencimento ASC`,
    [hoje, seteDias, tenantId]
  );
}

function getEmprestimosAtrasados(hoje, tenantId) {
  return queryAll(
    `SELECT e.id, e.valor, e.data_vencimento, e.taxa, c.nome as cliente_nome
     FROM emprestimos e LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE e.status IN ('ativo', 'atrasado') AND e.data_vencimento < ? AND e.tenant_id = ?
     ORDER BY e.data_vencimento ASC LIMIT 10`,
    [hoje, tenantId]
  );
}

function getTopClientes(tenantId) {
  return queryAll(
    `SELECT c.id, c.nome, c.limite, COUNT(e.id) as num_emprestimos, COALESCE(SUM(e.valor), 0) as total_emprestado
     FROM clientes c LEFT JOIN emprestimos e ON c.id = e.cliente_id AND e.tenant_id = ?
     WHERE c.tenant_id = ?
     GROUP BY c.id ORDER BY total_emprestado DESC LIMIT 5`,
    [tenantId, tenantId]
  );
}

function getEmprestimosFinalizadosCount(tenantId) {
  return queryOne(
    "SELECT COUNT(*) as total FROM emprestimos WHERE status IN ('quitado', 'atrasado') AND tenant_id = ?",
    [tenantId]
  )?.total || 0;
}

function getEmprestimosMensalUltimos12Meses(tenantId) {
  return queryAll(
    `SELECT strftime('%Y-%m', created_at) as mes,
            COUNT(*) as quantidade,
            COALESCE(SUM(valor), 0) as valor_total
     FROM emprestimos WHERE tenant_id = ? AND created_at >= date('now', '-12 months')
     GROUP BY mes ORDER BY mes ASC`,
    [tenantId]
  );
}

function getFluxoMensalUltimos12Meses(tenantId) {
  return queryAll(
    `SELECT strftime('%Y-%m', data) as mes,
            tipo,
            COALESCE(SUM(valor), 0) as total
     FROM transacoes WHERE tenant_id = ? AND data >= date('now', '-12 months')
     GROUP BY mes, tipo ORDER BY mes ASC`,
    [tenantId]
  );
}

module.exports = {
  getClientesTotal,
  getClientesAtivos,
  getClientesBlacklist,
  getEmprestimosTotal,
  getEmprestimosAtivos,
  getEmprestimosQuitados,
  getFinanceiroAtivos,
  getCaixaSaldo,
  getAtivosPorTipo,
  getNovosClientes7Dias,
  getEmprestimosPorStatus,
  getTransacoesTotalPorTipo,
  getEmprestimosAVencer,
  getEmprestimosAtrasados,
  getTopClientes,
  getEmprestimosFinalizadosCount,
  getEmprestimosMensalUltimos12Meses,
  getFluxoMensalUltimos12Meses,
};
