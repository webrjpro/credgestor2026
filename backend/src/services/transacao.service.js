const transacaoRepository = require('../repositories/transacao.repository');
const caixaService = require('./caixa.service');
const { transaction } = require('../database');
const { generateId, resolve } = require('../utils/helpers');

const DEFAULT_TENANT = 'default';

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
}

function mapToFrontend(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    tipo: row.tipo || 'entrada',
    descricao: row.descricao || '',
    valor: row.valor,
    data: row.data || '',
    referenciaId: row.referencia_id || '',
    clienteNome: row.cliente_nome || '',
  };
}

async function getTransacao(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const row = transacaoRepository.findTransacaoById(id, safeTenant);
  return mapToFrontend(row);
}

async function listTransacoes({ tenantId, referenciaId, tipo, from, to, page, limit }) {
  const safeTenant = normalizeTenantId(tenantId);
  const offset = (page - 1) * limit;

  const total = transacaoRepository.countTransacoes({ tenantId: safeTenant, referenciaId, tipo, from, to });
  const rows = transacaoRepository.listTransacoes({ tenantId: safeTenant, referenciaId, tipo, from, to, limit, offset });

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

async function createTransacao(tenantId, b) {
  const safeTenant = normalizeTenantId(tenantId);
  const now = new Date().toISOString();
  const id = (b.id || generateId()).toString();

  const tipo = b.tipo || 'entrada';
  if (!['entrada', 'saida'].includes(tipo)) {
    const err = new Error('tipo inválido (use "entrada" ou "saida")');
    err.statusCode = 400;
    err.code = 'INVALID_TRANSACTION_TYPE';
    throw err;
  }
  const descricao = b.descricao || '';
  const valor = b.valor;
  const data = b.data || now.split('T')[0];
  const referenciaId = resolve(b, 'referenciaId', 'referencia_id', '');
  const clienteNome = resolve(b, 'clienteNome', 'cliente_nome', '');

  let caixaResult = null;

  transaction(() => {
    transacaoRepository.createTransacao({
      id,
      tipo,
      descricao,
      valor,
      data,
      referencia_id: referenciaId,
      cliente_nome: clienteNome,
      tenant_id: safeTenant,
      created_at: now,
    });

    caixaResult = caixaService.applyMovement({
      tenantId: safeTenant,
      tipo,
      valor,
      descricao: descricao || `Transação ${tipo}`,
      data,
      createdAt: now,
    });
  });

  const created = transacaoRepository.findTransacaoById(id, safeTenant);
  return {
    transacao: mapToFrontend(created),
    caixa: caixaResult ? { saldo: caixaResult.saldoPosterior, historico: caixaResult.historico } : null,
  };
}

async function batchCreateTransacoes(tenantId, items) {
  const safeTenant = normalizeTenantId(tenantId);
  const now = new Date().toISOString();
  let created = 0;
  const errors = [];

  let caixaResult = null;

  transaction(() => {
    for (let i = 0; i < items.length; i++) {
      const b = items[i];
      if (!b || typeof b !== 'object') { errors.push(`Item ${i}: inválido`); continue; }
      const tipo = b.tipo || 'entrada';
      if (!['entrada', 'saida'].includes(tipo)) { errors.push(`Item ${i}: tipo inválido`); continue; }
      const valor = Number(b.valor);
      if (!Number.isFinite(valor) || valor <= 0) { errors.push(`Item ${i}: valor inválido (deve ser > 0)`); continue; }

      const id = (b.id || generateId()).toString();
      const data = b.data || now.split('T')[0];
      const descricao = (b.descricao || '').toString().slice(0, 5000);

      transacaoRepository.createTransacao({
        id,
        tipo,
        descricao,
        valor,
        data,
        referencia_id: resolve(b, 'referenciaId', 'referencia_id', ''),
        cliente_nome: resolve(b, 'clienteNome', 'cliente_nome', ''),
        tenant_id: safeTenant,
        created_at: now,
      });

      caixaResult = caixaService.applyMovement({
        tenantId: safeTenant,
        tipo,
        valor,
        descricao: descricao || `Transação ${tipo}`,
        data,
        createdAt: now,
      });

      created++;
    }
  });

  return {
    success: true,
    created,
    errors: errors.length ? errors : undefined,
    caixa: caixaResult ? { saldo: caixaResult.saldoPosterior, historico: caixaResult.historico } : null,
  };
}

async function deleteTransacao(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const tx = transacaoRepository.findTransacaoById(id, safeTenant);
  if (!tx) {
    const err = new Error('Transação não encontrada');
    err.statusCode = 404;
    err.code = 'TRANSACTION_NOT_FOUND';
    throw err;
  }

  const now = new Date().toISOString();
  let caixaResult = null;

  transaction(() => {
    caixaResult = caixaService.applyMovement({
      tenantId: safeTenant,
      tipo: tx.tipo === 'entrada' ? 'saida' : 'entrada',
      valor: tx.valor,
      descricao: `Estorno transação ${id}`,
      data: now,
      createdAt: now,
    });

    transacaoRepository.deleteTransacao(id, safeTenant);
  });

  return {
    success: true,
    caixa: caixaResult ? { saldo: caixaResult.saldoPosterior, historico: caixaResult.historico } : null,
  };
}

module.exports = {
  getTransacao,
  listTransacoes,
  createTransacao,
  batchCreateTransacoes,
  deleteTransacao,
};
