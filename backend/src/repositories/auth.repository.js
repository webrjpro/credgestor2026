const { queryOne, queryAll, run } = require('../database');

function findUserByEmail(email) {
  return queryOne('SELECT * FROM auth WHERE email = ?', [email]);
}

function findUserById(id) {
  return queryOne('SELECT id, nome, email, role, tenant_id, created_at, last_login, updated_at FROM auth WHERE id = ?', [id]);
}

function getUserCount() {
  const row = queryOne('SELECT COUNT(*) as c FROM auth');
  return row ? row.c : 0;
}

function createUser({ nome, email, passwordHash, role, tenantId, now }) {
  const result = run(
    `INSERT INTO auth (nome, email, password_hash, hash_version, role, tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, 'bcrypt', ?, ?, ?, ?)`,
    [nome, email, passwordHash, role, tenantId, now, now]
  );
  return result.lastInsertRowid;
}

function updateLastLogin(id, timestamp) {
  return run('UPDATE auth SET last_login = ? WHERE id = ?', [timestamp, id]);
}

function updatePassword(id, passwordHash, now) {
  return run(
    `UPDATE auth 
     SET password_hash = ?, salt = '', hash_version = 'bcrypt', updated_at = ? 
     WHERE id = ?`,
    [passwordHash, now, id]
  );
}

function saveRefreshToken(userId, token, expiresAt) {
  return run(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
}

function deleteRefreshToken(token) {
  return run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
}

function findRefreshToken(token) {
  return queryOne('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
}

function saveRevokedToken(jti, userId, expiresAtIso) {
  return run(
    'INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at) VALUES (?, ?, ?)',
    [jti, userId, expiresAtIso]
  );
}

function isTokenRevoked(jti) {
  const row = queryOne('SELECT jti FROM revoked_tokens WHERE jti = ?', [jti]);
  return !!row;
}

function deleteRevokedTokensBefore(isoDate) {
  return run('DELETE FROM revoked_tokens WHERE expires_at < ?', [isoDate]);
}

function deleteRefreshTokensBefore(isoDate) {
  return run('DELETE FROM refresh_tokens WHERE expires_at < ?', [isoDate]);
}

module.exports = {
  findUserByEmail,
  findUserById,
  getUserCount,
  createUser,
  updateLastLogin,
  updatePassword,
  saveRefreshToken,
  deleteRefreshToken,
  findRefreshToken,
  saveRevokedToken,
  isTokenRevoked,
  deleteRevokedTokensBefore,
  deleteRefreshTokensBefore,
};
