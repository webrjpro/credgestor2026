const tenantService = require('../services/tenant.service');

async function listUsers(req, res) {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    const result = await tenantService.listUsers(tenantId, req.user);
    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[TENANT CONTROLLER] Erro ao listar usuários:', err);
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

async function createUser(req, res) {
  try {
    const tenantId = req.tenantId || 'default';
    const result = await tenantService.createUser(tenantId, req.body, req.user, req.ip);
    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[TENANT CONTROLLER] Erro ao criar usuário:', err);
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

async function deleteUser(req, res) {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    const userId = req.params.userId;
    const result = await tenantService.deleteUser(tenantId, userId, req.user, req.ip);
    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[TENANT CONTROLLER] Erro ao excluir usuário:', err);
    return res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
}

module.exports = {
  listUsers,
  createUser,
  deleteUser,
};
