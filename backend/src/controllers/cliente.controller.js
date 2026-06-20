const clientesService = require('../services/clientes.service');
const auditRepository = require('../repositories/audit.repository');

async function listClientes(req, res) {
  try {
    const { page, limit, search, status, orderBy, order } = req.query;
    const tenantId = req.user.tenantId || 'default';
    const result = await clientesService.listClientes({
      tenantId,
      page,
      limit,
      search,
      status,
      orderBy,
      order,
    });
    return res.json(result);
  } catch (err) {
    console.error('[CLIENTE CONTROLLER] Erro ao listar:', err);
    return res.status(500).json({ error: 'Erro ao listar clientes' });
  }
}

async function getCliente(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;
    const cliente = await clientesService.getCliente(id, tenantId);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json(cliente);
  } catch (err) {
    console.error('[CLIENTE CONTROLLER] Erro ao buscar:', err);
    return res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
}

async function createCliente(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await clientesService.createCliente(tenantId, req.body);

    auditRepository.insertAuditLog(
      req.user.id,
      'CREATE_CLIENTE',
      { clienteId: result.id, nome: result.nome },
      req.ip,
      tenantId
    );

    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[CLIENTE CONTROLLER] Erro ao criar:', err);
    return res.status(500).json({ error: 'Erro ao criar cliente' });
  }
}

async function batchCreateClientes(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const clientes = Array.isArray(req.body)
      ? req.body
      : (Array.isArray(req.body?.clientes) ? req.body.clientes : null);
    if (!clientes) {
      return res.status(400).json({ error: 'Body deve ser um array de clientes' });
    }

    const result = await clientesService.batchCreateClientes(tenantId, clientes);

    auditRepository.insertAuditLog(
      req.user.id,
      'BATCH_CLIENTES',
      { count: result.count },
      req.ip,
      tenantId
    );

    return res.status(201).json(result);
  } catch (err) {
    console.error('[CLIENTE CONTROLLER] Erro no batch:', err);
    return res.status(500).json({ error: 'Erro ao importar clientes em lote' });
  }
}

async function updateCliente(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;
    const result = await clientesService.updateCliente(id, tenantId, req.body);

    auditRepository.insertAuditLog(
      req.user.id,
      'UPDATE_CLIENTE',
      { clienteId: id, changes: Object.keys(req.body) },
      req.ip,
      tenantId
    );

    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[CLIENTE CONTROLLER] Erro ao atualizar:', err);
    return res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
}

async function deleteCliente(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;
    await clientesService.deleteCliente(id, tenantId);

    auditRepository.insertAuditLog(
      req.user.id,
      'DELETE_CLIENTE',
      { clienteId: id },
      req.ip,
      tenantId
    );

    return res.json({ success: true });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[CLIENTE CONTROLLER] Erro ao excluir:', err);
    return res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
}

async function checkMatricula(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const matricula = req.query.matricula;
    const excludeId = req.query.excludeId;
    const result = await clientesService.checkMatricula(tenantId, matricula, excludeId);
    return res.json(result);
  } catch (err) {
    console.error('[CLIENTE CONTROLLER] Erro ao verificar matricula:', err);
    return res.status(500).json({ error: 'Erro ao verificar matricula', success: false, exists: false, normalized: '' });
  }
}

async function setBlacklist(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;
    const { blocked, motivo } = req.body;
    
    const cliente = await clientesService.setBlacklist({
      tenantId,
      clienteId: id,
      blocked,
      motivo,
    });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    auditRepository.insertAuditLog(
      req.user.id,
      blocked ? 'BLACKLIST_CLIENTE' : 'UNBLACKLIST_CLIENTE',
      { clienteId: id, motivo: motivo || '' },
      req.ip,
      tenantId
    );

    return res.json(cliente);
  } catch (err) {
    console.error('[CLIENTE CONTROLLER] Erro ao alterar blacklist:', err);
    return res.status(500).json({ error: 'Erro ao alterar Lista de Bloqueados' });
  }
}

module.exports = {
  listClientes,
  getCliente,
  createCliente,
  batchCreateClientes,
  updateCliente,
  deleteCliente,
  checkMatricula,
  setBlacklist,
};
