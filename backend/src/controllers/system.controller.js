const systemService = require('../services/system.service');
const auditRepository = require('../repositories/audit.repository');

async function getSystemState(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const state = await systemService.getSystemState(tenantId);
    return res.json(state);
  } catch (err) {
    console.error('[SYSTEM CONTROLLER] Erro ao obter estado:', err);
    return res.status(500).json({ error: 'Erro ao gerar backup de estado' });
  }
}

async function restoreSystemState(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const state = req.body;
    await systemService.restoreSystemState(tenantId, state);

    auditRepository.insertAuditLog(
      req.user.id,
      'RESTORE_BACKUP',
      { success: true },
      req.ip,
      tenantId
    );

    return res.json({ success: true });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[SYSTEM CONTROLLER] Erro ao restaurar backup:', err);
    return res.status(500).json({ error: 'Erro ao restaurar backup no banco local' });
  }
}

async function resetSystem(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    await systemService.resetSystem(tenantId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[SYSTEM CONTROLLER] Erro ao resetar:', err);
    return res.status(500).json({ error: 'Erro ao resetar dados no banco' });
  }
}

async function runRetentionPolicy(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const { transacoesDias, auditDays } = req.body;

    const result = await systemService.runRetentionPolicy(tenantId, { transacoesDias, auditDays });

    auditRepository.insertAuditLog(
      req.user.id,
      'RUN_RETENTION_POLICY',
      {
        transacoesDeletadas: result.transacoesDeletadas,
        logsDeletados: result.logsDeletados,
      },
      req.ip,
      tenantId
    );

    return res.json(result);
  } catch (err) {
    console.error('[SYSTEM CONTROLLER] Erro na política de retenção:', err);
    return res.status(500).json({ error: 'Erro ao executar política de retenção' });
  }
}

async function getHealth(req, res) {
  try {
    const result = await systemService.getHealth();
    return res.json(result);
  } catch (err) {
    console.error('[SYSTEM CONTROLLER] Erro no check de integridade:', err);
    return res.status(500).json({ error: 'Erro ao verificar integridade do banco de dados' });
  }
}

async function getCredentials(req, res) {
  try {
    const creds = await systemService.getCredentials();
    return res.json(creds);
  } catch (err) {
    console.error('[SYSTEM CONTROLLER] Erro ao obter credenciais:', err);
    return res.status(500).json({ error: 'Erro ao obter credenciais' });
  }
}

async function getDbStats(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const stats = await systemService.getDbStats(tenantId);
    return res.json(stats);
  } catch (err) {
    console.error('[SYSTEM CONTROLLER] Erro ao obter estatísticas do banco:', err);
    return res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
}

async function getAuditLogs(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';

    const result = await systemService.getAuditLogs(tenantId, {
      limit,
      offset,
      action,
      search,
      from,
      to,
    });

    return res.json(result);
  } catch (err) {
    console.error('[SYSTEM CONTROLLER] Erro ao listar audit_log:', err);
    return res.status(500).json({ error: 'Erro ao consultar logs de auditoria' });
  }
}

async function sqliteBackup(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const targetPathRaw = typeof req.body?.targetPath === 'string' ? req.body.targetPath.trim() : '';

    const result = await systemService.sqliteBackup(tenantId, {
      targetPathRaw,
      ip: req.ip,
      userId: req.user.id,
    });

    auditRepository.insertAuditLog(
      req.user.id,
      'SQLITE_PHYSICAL_BACKUP',
      { targetPath: result.path, size: result.size },
      req.ip,
      tenantId
    );

    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[SYSTEM CONTROLLER] Erro ao criar backup físico SQLite:', err);
    return res.status(500).json({ error: 'Erro ao criar backup fisico SQLite' });
  }
}

async function resetCredentials(req, res) {
  try {
    await systemService.resetCredentials();
    return res.json({ success: true });
  } catch (err) {
    console.error('[SYSTEM CONTROLLER] Erro ao resetar credenciais:', err);
    return res.status(500).json({ error: 'Erro ao resetar credenciais' });
  }
}

module.exports = {
  getSystemState,
  restoreSystemState,
  resetSystem,
  runRetentionPolicy,
  getHealth,
  getCredentials,
  getDbStats,
  getAuditLogs,
  sqliteBackup,
  resetCredentials,
};
