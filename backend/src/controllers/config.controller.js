const configService = require('../services/config.service');
const auditRepository = require('../repositories/audit.repository');

async function listConfigs(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await configService.listConfigs(tenantId);
    return res.json(result);
  } catch (err) {
    console.error('[CONFIG CONTROLLER] Erro ao listar:', err);
    return res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
}

async function getConfig(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await configService.getConfig(req.params.chave, tenantId);
    if (!result) return res.status(404).json({ error: 'Configuração não encontrada' });
    return res.json(result);
  } catch (err) {
    console.error('[CONFIG CONTROLLER] Erro ao buscar:', err);
    return res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
}

async function saveConfigs(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await configService.saveConfigs(tenantId, req.body);
    auditRepository.insertAuditLog(
      req.user.id,
      'UPDATE_CONFIG',
      { changes: Object.keys(req.body) },
      req.ip,
      tenantId
    );
    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[CONFIG CONTROLLER] Erro ao salvar:', err);
    return res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
}

async function saveConfig(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const chave = req.params.chave;
    let valor = req.body.valor;
    if (valor === undefined) valor = '';

    const result = await configService.saveConfig(chave, valor, tenantId);
    auditRepository.insertAuditLog(
      req.user.id,
      'UPDATE_CONFIG',
      { chave },
      req.ip,
      tenantId
    );
    return res.json(result);
  } catch (err) {
    console.error('[CONFIG CONTROLLER] Erro ao salvar uma config:', err);
    return res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
}

module.exports = {
  listConfigs,
  getConfig,
  saveConfigs,
  saveConfig,
};
