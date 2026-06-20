const { queryOne, queryAll, run } = require('../database');

function insertAuditLog(userId, action, details, ip, tenantId) {
  return run(
    'INSERT INTO audit_log (user_id, action, details, ip, tenant_id) VALUES (?, ?, ?, ?, ?)',
    [userId, action, JSON.stringify(details || {}), ip || '', tenantId || null]
  );
}

function listAuditLogs({ limit, offset, search, action, from, to }) {
  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (details LIKE ? OR action LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  if (action) {
    where += ' AND action = ?';
    params.push(action);
  }
  if (from) {
    where += ' AND timestamp >= ?';
    params.push(from);
  }
  if (to) {
    where += ' AND timestamp <= ?';
    params.push(to);
  }

  return queryAll(
    `SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

function countAuditLogs({ search, action, from, to }) {
  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (details LIKE ? OR action LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  if (action) {
    where += ' AND action = ?';
    params.push(action);
  }
  if (from) {
    where += ' AND timestamp >= ?';
    params.push(from);
  }
  if (to) {
    where += ' AND timestamp <= ?';
    params.push(to);
  }

  const row = queryOne(`SELECT COUNT(*) as total FROM audit_log ${where}`, params);
  return row ? row.total : 0;
}

function archiveAuditLogsBefore(isoDate) {
  return run(
    `INSERT INTO audit_log_archive (id, action, details, timestamp)
     SELECT id, action, details, timestamp FROM audit_log WHERE timestamp < ?`,
    [isoDate]
  );
}

function deleteAuditLogsBefore(isoDate) {
  return run('DELETE FROM audit_log WHERE timestamp < ?', [isoDate]);
}

module.exports = {
  insertAuditLog,
  listAuditLogs,
  countAuditLogs,
  archiveAuditLogsBefore,
  deleteAuditLogsBefore,
};
