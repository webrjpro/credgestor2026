const emprestimoRepository = require('../repositories/emprestimo.repository');
const clienteRepository = require('../repositories/cliente.repository');
const transacaoRepository = require('../repositories/transacao.repository');
const caixaService = require('./caixa.service');
const clientesService = require('./clientes.service');
const { transaction } = require('../database');
const { generateId, resolve } = require('../utils/helpers');

const DEFAULT_TENANT = 'default';

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function isCashDebitedApproval(aprovacao) {
  return aprovacao === 'aprovado' || aprovacao === 'arquivado';
}

function mapToFrontend(row) {
  if (!row) return null;
  let plano = {};
  try {
    plano = typeof row.plano === 'string' ? JSON.parse(row.plano || '{}') : {};
    if (!plano || typeof plano !== 'object' || Array.isArray(plano)) plano = {};
  } catch (_) { plano = {}; }

  const parcelas = (() => {
    try { return typeof row.historico_pagamentos === 'string' ? JSON.parse(row.historico_pagamentos || '[]') : []; }
    catch { return []; }
  })();

  return {
    id: String(row.id),
    clienteId: row.cliente_id,
    valorOriginal: row.valor,
    taxaJuros: row.taxa,
    valorTotal: plano.valorTotal ?? (row.valor_parcela * row.parcelas),
    tipo: row.tipo,
    dataInicio: row.data_inicio,
    dataVencimento: row.data_vencimento || '',
    multaDiaria: plano.multaDiaria ?? 1,
    multaFixa: plano.multaFixa ?? 0,
    carenciaDias: plano.carenciaDias ?? 5,
    parcelas,
    statusGeral: row.status || 'ativo',
    aprovacao: plano.aprovacao ?? 'aprovado',
    liberadoPor: plano.liberadoPor ?? null,
    gestorResponsavel: plano.gestorResponsavel ?? '',
    obs: row.obs || '',
    updatedAt: row.updated_at || '',
  };
}

async function getEmprestimo(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const row = emprestimoRepository.findEmprestimoById(id, safeTenant);
  return mapToFrontend(row);
}

async function listEmprestimos({ tenantId, status, clienteId, orderBy, order, page, limit }) {
  const safeTenant = normalizeTenantId(tenantId);
  const offset = (page - 1) * limit;

  const allowedColumns = {
    created_at: 'created_at',
    valor: 'valor',
    data_vencimento: 'data_vencimento',
    status: 'status',
    data_inicio: 'data_inicio'
  };
  const col = allowedColumns[orderBy] || 'data_inicio';
  const dir = order === 'desc' ? 'DESC' : 'ASC';

  const total = emprestimoRepository.countEmprestimos({ tenantId: safeTenant, status, clienteId });
  const rows = emprestimoRepository.listEmprestimos({ tenantId: safeTenant, status, clienteId, col, dir, limit, offset });

  return {
    data: rows.map(mapToFrontend),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function createEmprestimo(tenantId, b) {
  const safeTenant = normalizeTenantId(tenantId);
  const now = new Date().toISOString();
  
  const id = b.id || generateId();
  const clienteId = b.clienteId || b.cliente_id;
  const valor = Number(b.valor ?? b.valorOriginal ?? 0);
  const taxa = Number(b.taxa ?? b.taxaJuros ?? 0);
  
  const cliente = clienteRepository.findClienteById(clienteId, safeTenant);
  if (!cliente) {
    const err = new Error('Cliente não encontrado');
    err.statusCode = 404;
    err.code = 'CLIENT_NOT_FOUND';
    throw err;
  }

  const isArray = Array.isArray(b.parcelas);
  const parcelasCount = isArray ? b.parcelas.length : (Number(b.parcelas) || 1);
  const historico = isArray ? b.parcelas : [];

  const planoData = JSON.stringify({
    multaDiaria: Number(b.multaDiaria ?? 1),
    multaFixa: Number(b.multaFixa ?? 0),
    carenciaDias: Number(b.carenciaDias ?? 5),
    valorTotal: Number(b.valorTotal ?? (valor + valor * taxa / 100)),
    gestorResponsavel: b.gestorResponsavel || '',
    liberadoPor: b.liberadoPor || null,
    aprovacao: b.aprovacao || 'aprovado',
  });

  const valParc = resolve(b, 'valorParcela', 'valor_parcela', null) ?? (parcelasCount > 0 ? (Number(b.valorTotal ?? 0) / parcelasCount) : valor);

  let caixaResult = null;

  transaction(() => {
    emprestimoRepository.createEmprestimo({
      id,
      cliente_id: clienteId,
      valor,
      tipo: b.tipo || 'parcelado',
      taxa,
      parcelas: parcelasCount,
      parcelas_pagas: isArray ? b.parcelas.filter(p => p.status === 'pago').length : 0,
      valor_parcela: valParc,
      data_inicio: resolve(b, 'dataInicio', 'data_inicio', now.split('T')[0]),
      data_vencimento: resolve(b, 'dataVencimento', 'data_vencimento', null),
      status: b.statusGeral || b.status || 'ativo',
      historico_pagamentos: JSON.stringify(historico),
      obs: b.obs || '',
      plano: planoData,
      tenant_id: safeTenant,
      created_at: now,
      updated_at: now,
    });

    if (isCashDebitedApproval(b.aprovacao || 'aprovado')) {
      caixaResult = caixaService.applyMovement({
        tenantId: safeTenant,
        tipo: 'saida',
        valor,
        descricao: `Empréstimo concedido - ${cliente.nome}`,
        data: resolve(b, 'dataInicio', 'data_inicio', now.split('T')[0]),
        createdAt: now,
        allowNegative: false,
      });
    }
  });

  const created = emprestimoRepository.findEmprestimoById(id, safeTenant);
  return {
    emprestimo: mapToFrontend(created),
    caixa: caixaResult ? { saldo: caixaResult.saldoPosterior, historico: caixaResult.historico } : null,
  };
}

async function updateEmprestimo(id, tenantId, b) {
  const safeTenant = normalizeTenantId(tenantId);
  const existing = emprestimoRepository.findEmprestimoById(id, safeTenant);
  if (!existing) {
    const err = new Error('Empréstimo não encontrado');
    err.statusCode = 404;
    err.code = 'LOAN_NOT_FOUND';
    throw err;
  }

  const existingPlano = safeJsonParse(existing.plano, {});
  const existingHist = safeJsonParse(existing.historico_pagamentos, []);

  const valor = b.valor ?? b.valorOriginal ?? existing.valor;
  const taxa = b.taxa ?? b.taxaJuros ?? existing.taxa;
  const status = b.status || b.statusGeral || existing.status;
  const tipo = b.tipo || existing.tipo;
  const obs = b.obs !== undefined ? b.obs : existing.obs;

  const parcelasIsArray = Array.isArray(b.parcelas);
  let parcelasCount, historico;
  if (parcelasIsArray) {
    parcelasCount = b.parcelas.length;
    historico = b.parcelas;
  } else if (b.historicoPagamentos || b.historico_pagamentos) {
    historico = b.historicoPagamentos || b.historico_pagamentos;
    parcelasCount = Array.isArray(historico) ? historico.length : (b.parcelas || existing.parcelas);
  } else {
    historico = existingHist;
    parcelasCount = b.parcelas || existing.parcelas;
  }

  const parcelasPagas = resolve(b, 'parcelasPagas', 'parcelas_pagas', null)
    ?? (Array.isArray(historico) ? historico.filter(p => p.status === 'pago').length : existing.parcelas_pagas);

  const valorParcela = resolve(b, 'valorParcela', 'valor_parcela', null) ?? existing.valor_parcela;
  const aprovacaoAnterior = existingPlano.aprovacao ?? 'aprovado';
  const aprovacao = b.aprovacao ?? existingPlano.aprovacao ?? 'aprovado';
  const debitoAnterior = isCashDebitedApproval(aprovacaoAnterior) ? Number(existing.valor || 0) : 0;
  const debitoNovo = isCashDebitedApproval(aprovacao) ? Number(valor || 0) : 0;
  const diferencaCaixa = debitoNovo - debitoAnterior;
  const temPagamento = Array.isArray(historico) && historico.some(p => p && p.status === 'pago');

  if (Math.abs(diferencaCaixa) > 0.000001 && temPagamento) {
    const err = new Error('Contrato com pagamento não pode ter aprovação ou valor alterado.');
    err.statusCode = 409;
    err.code = 'LOAN_HAS_PAYMENTS';
    throw err;
  }

  const planoData = JSON.stringify({
    multaDiaria: b.multaDiaria ?? existingPlano.multaDiaria ?? 1,
    multaFixa: b.multaFixa ?? existingPlano.multaFixa ?? 0,
    carenciaDias: b.carenciaDias ?? existingPlano.carenciaDias ?? 5,
    valorTotal: b.valorTotal ?? existingPlano.valorTotal ?? (valor + valor * taxa / 100),
    gestorResponsavel: b.gestorResponsavel ?? existingPlano.gestorResponsavel ?? '',
    liberadoPor: b.liberadoPor ?? existingPlano.liberadoPor ?? null,
    aprovacao,
  });

  const now = new Date().toISOString();
  let caixaResult = null;

  transaction(() => {
    emprestimoRepository.updateEmprestimo(id, safeTenant, {
      cliente_id: b.clienteId || b.cliente_id || existing.cliente_id,
      valor,
      tipo,
      taxa,
      parcelas: parcelasCount,
      parcelas_pagas: parcelasPagas,
      valor_parcela: valorParcela,
      data_inicio: resolve(b, 'dataInicio', 'data_inicio', existing.data_inicio),
      data_vencimento: resolve(b, 'dataVencimento', 'data_vencimento', existing.data_vencimento),
      status,
      historico_pagamentos: JSON.stringify(historico),
      obs,
      plano: planoData,
      updated_at: now,
    });

    if (Math.abs(diferencaCaixa) > 0.000001) {
      caixaResult = caixaService.applyMovement({
        tenantId: safeTenant,
        tipo: diferencaCaixa > 0 ? 'saida' : 'entrada',
        valor: Math.abs(diferencaCaixa),
        descricao: diferencaCaixa > 0
          ? `Aprovação/ajuste contrato #${id}`
          : `Estorno aprovação/ajuste contrato #${id}`,
        data: now,
        createdAt: now,
        allowNegative: diferencaCaixa <= 0,
      });
    }
  });

  const updated = emprestimoRepository.findEmprestimoById(id, safeTenant);
  return {
    emprestimo: mapToFrontend(updated),
    caixa: caixaResult ? { saldo: caixaResult.saldoPosterior, historico: caixaResult.historico } : null,
  };
}

async function deleteEmprestimo(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const existing = emprestimoRepository.findEmprestimoById(id, safeTenant);
  if (!existing) {
    const err = new Error('Empréstimo não encontrado');
    err.statusCode = 404;
    err.code = 'LOAN_NOT_FOUND';
    throw err;
  }

  const historico = safeJsonParse(existing.historico_pagamentos, []);
  const hasPaidParcel = Number(existing.parcelas_pagas || 0) > 0
    || (Array.isArray(historico) && historico.some(p => p && (p.status === 'pago' || Number(p.valorPago || 0) > 0)));
  
  const linkedPaymentsCount = transacaoRepository.countTransacoes({
    tenantId: safeTenant,
    referenciaId: id,
    tipo: 'entrada'
  });

  if (hasPaidParcel || Number(linkedPaymentsCount || 0) > 0) {
    const err = new Error('Empréstimo com pagamento registrado não pode ser excluído. Estorne os pagamentos antes.');
    err.statusCode = 409;
    err.code = 'LOAN_HAS_PAYMENTS';
    throw err;
  }

  const now = new Date().toISOString();
  const existingPlano = safeJsonParse(existing.plano, {});
  let caixaResult = null;

  transaction(() => {
    if (isCashDebitedApproval(existingPlano.aprovacao ?? 'aprovado')) {
      caixaResult = caixaService.applyMovement({
        tenantId: safeTenant,
        tipo: 'entrada',
        valor: existing.valor,
        descricao: `Estorno principal empréstimo #${id}`,
        data: now,
        createdAt: now,
      });
    }

    // Estornar pagamentos (transações avulsas ou parciais).
    const txs = transacaoRepository.listTransacoes({
      tenantId: safeTenant,
      referenciaId: id,
      limit: 1000,
      offset: 0
    });
    
    let totalEntrada = 0;
    let totalSaida = 0;
    for (const t of txs) {
      if (t.tipo === 'entrada') totalEntrada += t.valor;
      else if (t.tipo === 'saida') totalSaida += t.valor;
    }
    const liquido = totalEntrada - totalSaida;

    if (liquido !== 0) {
      caixaResult = caixaService.applyMovement({
        tenantId: safeTenant,
        tipo: liquido > 0 ? 'saida' : 'entrada',
        valor: Math.abs(liquido),
        descricao: `Estorno transações empréstimo #${id}`,
        data: now,
        createdAt: now,
      });
    }

    // Deletar transações vinculadas e deletar empréstimo.
    for (const t of txs) {
      transacaoRepository.deleteTransacao(t.id, safeTenant);
    }
    emprestimoRepository.deleteEmprestimo(id, safeTenant);
  });

  return {
    success: true,
    caixa: caixaResult ? { saldo: caixaResult.saldoPosterior, historico: caixaResult.historico } : null,
  };
}

async function registrarPagamento(id, tenantId, { valor, metodo, observacao, scoreEventos, pagouComMulta, parcelas, status, statusGeral }) {
  const safeTenant = normalizeTenantId(tenantId);
  const now = new Date().toISOString();

  const emp = emprestimoRepository.findEmprestimoById(id, safeTenant);
  if (!emp) {
    const err = new Error('Empréstimo não encontrado');
    err.statusCode = 404;
    err.code = 'LOAN_NOT_FOUND';
    throw err;
  }
  if (emp.status === 'quitado') {
    const err = new Error('Empréstimo já quitado');
    err.statusCode = 409;
    err.code = 'LOAN_ALREADY_PAID';
    throw err;
  }

  const cliente = clienteRepository.findClienteById(emp.cliente_id, safeTenant);
  const clienteNome = cliente ? cliente.nome : '';

  const txId = generateId();
  const valorParcela = emp.valor_parcela > 0 ? emp.valor_parcela : (emp.valor / Math.max(1, emp.parcelas || 1));
  const parcelasRestantes = Math.max(0, (emp.parcelas || 0) - (emp.parcelas_pagas || 0));
  
  let parcelasCobertas = valorParcela > 0 ? Math.floor(valor / valorParcela) : 0;
  if (parcelasCobertas < 1 && valor > 0) parcelasCobertas = 1;
  parcelasCobertas = Math.min(parcelasCobertas, parcelasRestantes);

  const providedHistorico = Array.isArray(parcelas)
    ? parcelas
    : (Array.isArray(req.body?.historicoPagamentos)
      ? req.body.historicoPagamentos
      : (Array.isArray(req.body?.historico_pagamentos) ? req.body.historico_pagamentos : null)); // fallback to query if needed, but passing parcelas is standard

  const existingHistorico = safeJsonParse(emp.historico_pagamentos, []);
  const nextHistorico = providedHistorico || existingHistorico;
  const newParcelasPagas = Array.isArray(providedHistorico)
    ? providedHistorico.filter(p => p && p.status === 'pago').length
    : (emp.parcelas_pagas || 0) + parcelasCobertas;
    
  const isQuitado = newParcelasPagas >= emp.parcelas;
  const nextStatus = statusGeral || status || (isQuitado ? 'finalizado' : emp.status);
  
  let caixaResult = null;
  let clienteResult = null;
  const txData = now.split('T')[0];
  const txDescricao = observacao || 'Pagamento empréstimo';

  transaction(() => {
    // 1. Registrar transação financeira
    transacaoRepository.createTransacao({
      id: txId,
      tipo: 'entrada',
      descricao: txDescricao,
      valor,
      data: txData,
      referencia_id: id,
      cliente_nome: clienteNome,
      tenant_id: safeTenant,
      created_at: now,
    });

    // 2. Atualizar ledger de caixa
    caixaResult = caixaService.applyMovement({
      tenantId: safeTenant,
      tipo: 'entrada',
      valor,
      descricao: `Pagamento empréstimo #${id}`,
      data: now,
      createdAt: now,
    });

    // 3. Atualizar empréstimo
    emprestimoRepository.updateEmprestimo(id, safeTenant, {
      ...emp,
      parcelas_pagas: newParcelasPagas,
      historico_pagamentos: JSON.stringify(nextHistorico),
      status: nextStatus,
      updated_at: now,
    });

    // 4. Atualizar score/blacklist
    clienteResult = clientesService.applyPaymentScore({
      tenantId: safeTenant,
      clienteId: emp.cliente_id,
      scoreEventos,
      pagouComMulta,
      now,
    });
  });

  const updated = emprestimoRepository.findEmprestimoById(id, safeTenant);
  return {
    transacaoId: txId,
    emprestimo: mapToFrontend(updated),
    transacao: {
      id: txId,
      tipo: 'entrada',
      descricao: txDescricao,
      valor,
      data: txData,
      referenciaId: id,
      clienteNome,
    },
    cliente: clienteResult,
    caixa: caixaResult ? { saldo: caixaResult.saldoPosterior, historico: caixaResult.historico } : null,
  };
}

module.exports = {
  getEmprestimo,
  listEmprestimos,
  createEmprestimo,
  updateEmprestimo,
  deleteEmprestimo,
  registrarPagamento,
  mapToFrontend,
};
