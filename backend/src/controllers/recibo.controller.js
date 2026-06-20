const reciboService = require('../services/recibo.service');
const auditRepository = require('../repositories/audit.repository');

async function criarRecibos(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const { arquivoId, contratos } = req.body;

    const result = await reciboService.criarRecibos(tenantId, { arquivoId, contratos });

    auditRepository.insertAuditLog(
      req.user.id,
      'CREATE_RECIBOS',
      { arquivoId, count: result.length },
      req.ip,
      tenantId
    );

    return res.status(201).json({ success: true, criados: result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[RECIBO CONTROLLER] Erro ao criar recibos:', err);
    return res.status(500).json({ error: 'Erro ao criar recibos de entrega' });
  }
}

async function listRecibosByArquivo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await reciboService.listRecibosByArquivo(req.params.arquivoId, tenantId);
    return res.json(result);
  } catch (err) {
    console.error('[RECIBO CONTROLLER] Erro ao listar por arquivo:', err);
    return res.status(500).json({ error: 'Erro ao listar recibos' });
  }
}

async function listRecibosPendentes(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await reciboService.listRecibosPendentes(tenantId);
    return res.json(result);
  } catch (err) {
    console.error('[RECIBO CONTROLLER] Erro ao listar pendentes:', err);
    return res.status(500).json({ error: 'Erro ao listar recibos pendentes' });
  }
}

async function getRecibo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await reciboService.getRecibo(req.params.id, tenantId);
    if (!result) return res.status(404).json({ error: 'Recibo não encontrado' });
    return res.json(result);
  } catch (err) {
    console.error('[RECIBO CONTROLLER] Erro ao buscar:', err);
    return res.status(500).json({ error: 'Erro ao buscar recibo' });
  }
}

async function entregarRecibo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const reciboId = req.params.id;
    const { operadorNome, operadorEmail, observacao, pdfHash } = req.body;

    const result = await reciboService.entregarRecibo(reciboId, tenantId, {
      operadorNome,
      operadorEmail,
      observacao,
      pdfHash,
    });

    auditRepository.insertAuditLog(
      req.user.id,
      'ENTREGAR_RECIBO',
      { reciboId },
      req.ip,
      tenantId
    );

    return res.json({ success: true, recibo: result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[RECIBO CONTROLLER] Erro ao entregar:', err);
    return res.status(500).json({ error: 'Erro ao registrar entrega de recibo' });
  }
}

async function estornarRecibo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const reciboId = req.params.id;
    const { operadorNome, operadorEmail, justificativa } = req.body;

    const just = String(justificativa || '').trim();
    if (just.length < 5) {
      return res.status(400).json({ error: 'Justificativa obrigatória (mín. 5 caracteres)' });
    }

    const result = await reciboService.estornarRecibo(reciboId, tenantId, {
      justificativa: just,
      operadorNome,
      operadorEmail,
    });

    auditRepository.insertAuditLog(
      req.user.id,
      'ESTORNAR_RECIBO',
      { reciboId },
      req.ip,
      tenantId
    );

    return res.json({ success: true, recibo: result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[RECIBO CONTROLLER] Erro ao estornar:', err);
    return res.status(500).json({ error: 'Erro ao estornar recibo' });
  }
}

module.exports = {
  criarRecibos,
  listRecibosByArquivo,
  listRecibosPendentes,
  getRecibo,
  entregarRecibo,
  estornarRecibo,
};
