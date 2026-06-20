const caixaService = require('../services/caixa.service');
const auditRepository = require('../repositories/audit.repository');

async function getResumo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = caixaService.getResumo(tenantId);
    return res.json(result);
  } catch (err) {
    console.error('[CAIXA CONTROLLER] Erro ao buscar resumo:', err);
    return res.status(500).json({ error: 'Erro ao buscar caixa' });
  }
}

async function ajustarSaldo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const { saldo } = req.body;
    const result = caixaService.setSaldo({
      tenantId,
      saldo,
      descricao: 'Ajuste manual de saldo',
    });

    auditRepository.insertAuditLog(
      req.user.id,
      'ADJUST_CAIXA',
      {
        saldoAnterior: result.saldoAnterior,
        novoSaldo: result.saldoPosterior,
      },
      req.ip,
      tenantId
    );

    return res.json({ success: true, saldo: result.saldoPosterior, historico: result.historico });
  } catch (err) {
    const mapped = caixaService.mapError(err);
    if (mapped.statusCode >= 500) {
      console.error('[CAIXA CONTROLLER] Erro ao ajustar:', err);
    }
    return res.status(mapped.statusCode).json(mapped.body);
  }
}

async function listHistorico(req, res) {
  try {
    const { page, limit, tipo, from, to } = req.query;
    const tenantId = req.user.tenantId || 'default';
    const result = caixaService.listHistorico({ tenantId, page, limit, tipo, from, to });
    return res.json(result);
  } catch (err) {
    console.error('[CAIXA CONTROLLER] Erro no histórico:', err);
    return res.status(500).json({ error: 'Erro ao listar histórico' });
  }
}

async function recordMovement(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const { tipo, valor, descricao, data } = req.body;
    const result = caixaService.recordMovement({ tenantId, tipo, valor, descricao, data });
    const entry = result.historico;

    auditRepository.insertAuditLog(
      req.user.id,
      'MANUAL_MOVIMENTACAO',
      { tipo, valor, descricao },
      req.ip,
      tenantId
    );

    return res.status(201).json(entry);
  } catch (err) {
    const mapped = caixaService.mapError(err);
    if (mapped.statusCode >= 500) {
      console.error('[CAIXA CONTROLLER] Erro na movimentação:', err);
    }
    return res.status(mapped.statusCode).json(mapped.body);
  }
}

module.exports = {
  getResumo,
  ajustarSaldo,
  listHistorico,
  recordMovement,
};
