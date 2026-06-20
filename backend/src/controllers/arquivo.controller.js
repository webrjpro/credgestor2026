const arquivoService = require('../services/arquivo.service');
const auditRepository = require('../repositories/audit.repository');
const { logSync } = require('../database');

async function listArquivos(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await arquivoService.listArquivos(tenantId);
    return res.json({ data: result });
  } catch (err) {
    console.error('[ARQUIVO CONTROLLER] Erro ao listar:', err);
    return res.status(500).json({ error: 'Erro ao listar arquivo de aprovados' });
  }
}

async function getArquivo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await arquivoService.getArquivo(req.params.id, tenantId);
    if (!result) return res.status(404).json({ error: 'Registro não encontrado' });
    return res.json(result);
  } catch (err) {
    console.error('[ARQUIVO CONTROLLER] Erro ao buscar:', err);
    return res.status(500).json({ error: 'Erro ao buscar registro' });
  }
}

async function createArquivo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await arquivoService.createArquivo(tenantId, req.body);

    const { id } = result;
    auditRepository.insertAuditLog(req.user.id, 'CREATE_ARQUIVO', { id }, req.ip, tenantId);
    logSync('arquivo_aprovados', id, 'INSERT', tenantId);

    return res.status(201).json(result);
  } catch (err) {
    console.error('[ARQUIVO CONTROLLER] Erro ao criar:', err);
    return res.status(500).json({ error: 'Erro ao criar registro' });
  }
}

async function deleteArquivo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;

    await arquivoService.deleteArquivo(id, tenantId);

    auditRepository.insertAuditLog(req.user.id, 'DELETE_ARQUIVO', { id }, req.ip, tenantId);
    logSync('arquivo_aprovados', id, 'DELETE', tenantId);

    return res.json({ success: true });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[ARQUIVO CONTROLLER] Erro ao excluir:', err);
    return res.status(500).json({ error: 'Erro ao excluir registro' });
  }
}

module.exports = {
  listArquivos,
  getArquivo,
  createArquivo,
  deleteArquivo,
};
