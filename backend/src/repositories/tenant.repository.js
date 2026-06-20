const { queryOne, queryAll, run } = require('../database');

function findTenantById(id) {
  return queryOne('SELECT * FROM tenants WHERE id = ?', [id]);
}

function findTenantBySlug(slug) {
  return queryOne('SELECT * FROM tenants WHERE slug = ?', [slug]);
}

function listTenants() {
  return queryAll('SELECT * FROM tenants ORDER BY created_at DESC');
}

function createTenant({ id, nome, slug, plano, status, ownerId, config, maxUsers, expiresAt, now }) {
  return run(
    `INSERT INTO tenants (id, nome, slug, plano, status, owner_id, config, max_users, created_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nome, slug, plano, status, ownerId || null, JSON.stringify(config || {}), maxUsers || 1, now, now, expiresAt || null]
  );
}

function updateTenant(id, t) {
  return run(
    `UPDATE tenants
     SET nome = ?, slug = ?, plano = ?, status = ?, owner_id = ?, config = ?, max_users = ?, updated_at = ?, expires_at = ?
     WHERE id = ?`,
    [t.nome, t.slug, t.plano, t.status, t.owner_id || null, JSON.stringify(t.config || {}), t.max_users, t.updated_at, t.expires_at || null, id]
  );
}

function deleteTenant(id) {
  return run('DELETE FROM tenants WHERE id = ?', [id]);
}

function findUsersByTenant(tenantId) {
  return queryAll(
    `SELECT id, nome, email, role, tenant_id, created_at, last_login, updated_at
       FROM auth
      WHERE tenant_id = ?
      ORDER BY role = 'admin' DESC, nome COLLATE NOCASE ASC, email COLLATE NOCASE ASC`,
    [tenantId]
  );
}

function countAdminsByTenant(tenantId) {
  const row = queryOne("SELECT COUNT(*) as c FROM auth WHERE tenant_id = ? AND role = 'admin'", [tenantId]);
  return row ? row.c : 0;
}

module.exports = {
  findTenantById,
  findTenantBySlug,
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  findUsersByTenant,
  countAdminsByTenant,
};
