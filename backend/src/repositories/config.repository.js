const { queryOne, queryAll, run } = require('../database');

function findConfigByKey(key, tenantId) {
  return queryOne('SELECT chave, valor FROM config WHERE chave = ? AND tenant_id = ?', [key, tenantId]);
}

function listConfigs(tenantId) {
  return queryAll('SELECT chave, valor FROM config WHERE tenant_id = ?', [tenantId]);
}

function saveConfig(key, value, tenantId, now) {
  return run(
    `INSERT INTO config (chave, valor, tenant_id, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(chave, tenant_id) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at`,
    [key, value, tenantId, now]
  );
}

module.exports = {
  findConfigByKey,
  listConfigs,
  saveConfig,
};
