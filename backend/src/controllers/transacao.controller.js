const transacaoService = require('../services/transacao.service');
const auditRepository = require('../repositories/audit.repository');
const { logSync } = require('../database');

async function listTransacoes(req, res) {
  try {
    const { page, limit, tipo, from, to } = req.query;
    const referenciaId = req.query.referenciaId || req.query.referencia_id;
    const tenantId = req.user.tenantId || 'default';

    const result = await transacaoService.listTransacoes({
      tenantId,
      referenciaId,
      tipo,
      from,
      to,
      page: Number(page) || 1,
      limit: Number(limit) || 10000,
    });

    return res.json(result);
  } catch (err) {
    console.error('[TRANSACOES CONTROLLER] Erro ao listar:', err);
    return res.status(500).json({ error: 'Erro ao listar transações' });
  }
}

async function getTransacao(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const tx = await transacaoService.getTransacao(req.params.id, tenantId);
    if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });
    return res.json(tx);
  } catch (err) {
    console.error('[TRANSACOES CONTROLLER] Erro ao buscar:', err);
    return res.status(500).json({ error: 'Erro ao buscar transação' });
  }
}

async function createTransacao(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await transacaoService.createTransacao(tenantId, req.body);

    const { transacao } = result;
    auditRepository.insertAuditLog(
      req.user.id,
      'CREATE_TRANSACAO',
      { id: transacao.id, tipo: transacao.tipo, valor: transacao.valor },
      req.ip,
      tenantId
    );
    logSync('transacoes', transacao.id, 'INSERT', tenantId);

    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[TRANSACOES CONTROLLER] Erro ao criar:', err);
    return res.status(500).json({ error: 'Erro ao criar transação' });
  }
}

async function batchCreateTransacoes(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Corpo deve ser um array' });
    }
    if (items.length > 10000) {
      return res.status(400).json({ error: 'Máximo 10.000 transações por lote' });
    }

    const result = await transacaoService.batchCreateTransacoes(tenantId, items);
    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[TRANSACOES CONTROLLER] Erro batch:', err);
    return res.status(500).json({ error: 'Erro ao importar transações' });
  }
}

async function deleteTransacao(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const txId = req.params.id;

    const tx = await transacaoService.getTransacao(txId, tenantId);
    if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });

    const result = await transacaoService.deleteTransacao(txId, tenantId);

    auditRepository.insertAuditLog(
      req.user.id,
      'DELETE_TRANSACAO',
      { id: txId, tipo: tx.tipo, valor: tx.valor },
      req.ip,
      tenantId
    );
    logSync('transacoes', txId, 'DELETE', tenantId);

    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[TRANSACOES CONTROLLER] Erro ao excluir:', err);
    return res.status(500).json({ error: 'Erro ao excluir transação' });
  }
}

module.exports = {
  listTransacoes,
  getTransacao,
  createTransacao,
  batchCreateTransacoes,
  deleteTransacao,
};
