const caixaRepository = require('../repositories/caixa.repository');
const { transaction } = require('../database');

const DEFAULT_TENANT = 'default';
const EPSILON = 0.000001;

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
}

function normalizeTipo(tipo) {
  if (tipo === 'saida') return 'saida';
  if (tipo === 'entrada') return 'entrada';
  const error = new Error('Tipo de movimentação inválido');
  error.code = 'INVALID_MOVEMENT_TYPE';
  error.statusCode = 400;
  throw error;
}

function normalizeValor(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    const error = new Error('Valor da movimentação deve ser positivo');
    error.code = 'INVALID_MOVEMENT_AMOUNT';
    error.statusCode = 400;
    throw error;
  }
  return n;
}

function normalizeSaldo(saldo) {
  const n = Number(saldo);
  if (!Number.isFinite(n)) {
    const error = new Error('Saldo inválido');
    error.code = 'INVALID_BALANCE';
    error.statusCode = 400;
    throw error;
  }
  return n;
}

function normalizeDate(value, now = new Date().toISOString()) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return now.slice(0, 10);
}

function makeHttpError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function ensureCaixaRow(tenantId, now = new Date().toISOString()) {
  const normalizedTenant = normalizeTenantId(tenantId);
  let row = caixaRepository.findCaixa(normalizedTenant);
  if (!row) {
    caixaRepository.createCaixa(normalizedTenant, 0, now);
    row = caixaRepository.findCaixa(normalizedTenant);
  }
  return row;
}

function getSaldo(tenantId) {
  const row = ensureCaixaRow(tenantId);
  return Number(row?.saldo || 0);
}

function applyMovement(options) {
  const tenantId = normalizeTenantId(options.tenantId);
  const tipo = normalizeTipo(options.tipo);
  const valor = normalizeValor(options.valor);
  const now = options.createdAt || new Date().toISOString();
  const data = normalizeDate(options.data, now);
  const descricao = String(options.descricao || '').slice(0, 500);
  const allowNegative = options.allowNegative !== false;

  const current = ensureCaixaRow(tenantId, now);
  const saldoAnterior = Number(current?.saldo || 0);
  const delta = tipo === 'entrada' ? valor : -valor;
  const saldoPosterior = saldoAnterior + delta;

  if (!allowNegative && saldoPosterior < -EPSILON) {
    throw makeHttpError('Saldo em caixa insuficiente para esta operação', 'INSUFFICIENT_CASH', 409);
  }

  caixaRepository.updateSaldo(tenantId, saldoPosterior, now);

  const histId = caixaRepository.insertHistorico({
    tipo,
    valor,
    descricao,
    data,
    saldoAnterior,
    saldoPosterior,
    tenantId,
    createdAt: now,
  });

  const historico = caixaRepository.getHistoricoById(histId);
  return {
    historico,
    saldoAnterior,
    saldoPosterior,
  };
}

function recordMovement(options) {
  let result;
  transaction(() => {
    result = applyMovement(options);
  });
  return result;
}

function setSaldo(options) {
  const tenantId = normalizeTenantId(options.tenantId);
  const saldo = normalizeSaldo(options.saldo);
  const now = options.createdAt || new Date().toISOString();
  const data = normalizeDate(options.data, now);
  const descricao = String(options.descricao || 'Ajuste manual de saldo').slice(0, 500);
  let result;

  transaction(() => {
    const current = ensureCaixaRow(tenantId, now);
    const saldoAnterior = Number(current?.saldo || 0);
    const diff = saldo - saldoAnterior;

    if (Math.abs(diff) <= EPSILON) {
      caixaRepository.updateSaldoSimple(tenantId, saldo, now);
      result = { historico: null, saldoAnterior, saldoPosterior: saldo };
      return;
    }

    result = applyMovement({
      tenantId,
      tipo: diff > 0 ? 'entrada' : 'saida',
      valor: Math.abs(diff),
      descricao,
      data,
      createdAt: now,
    });
  });

  return result;
}

function getResumo(tenantId) {
  const normalizedTenant = normalizeTenantId(tenantId);
  const caixa = ensureCaixaRow(normalizedTenant);
  const totals = caixaRepository.getCaixaAggregateTotals(normalizedTenant);

  return {
    saldo: Number(caixa?.saldo || 0),
    total_entradas: totals.totalEntradas,
    total_saidas: totals.totalSaidas,
    lucro: totals.totalEntradas - totals.totalSaidas,
    emprestimos_ativos: totals.emprestimosAtivosCount,
    valor_em_aberto: totals.emprestimosAtivosTotal,
    updated_at: caixa?.updated_at || '',
  };
}

function listHistorico({ tenantId, page = 1, limit = 10000, tipo = '', from = '', to = '' }) {
  const normalizedTenant = normalizeTenantId(tenantId);
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(10000, Math.max(1, Number(limit) || 10000));
  const offset = (safePage - 1) * safeLimit;

  const total = caixaRepository.countHistorico({ tenantId: normalizedTenant, tipo, from, to });
  const data = caixaRepository.listHistorico({ tenantId: normalizedTenant, offset, limit: safeLimit, tipo, from, to });

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / safeLimit),
    },
  };
}

function mapError(error) {
  return {
    statusCode: error?.statusCode || 500,
    body: {
      error: error?.message || 'Erro financeiro',
      code: error?.code || 'FINANCIAL_ERROR',
    },
  };
}

module.exports = {
  applyMovement,
  ensureCaixaRow,
  getResumo,
  getSaldo,
  listHistorico,
  mapError,
  recordMovement,
  setSaldo,
};
