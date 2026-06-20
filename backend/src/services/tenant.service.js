const tenantRepository = require('../repositories/tenant.repository');
const authRepository = require('../repositories/auth.repository');
const auditRepository = require('../repositories/audit.repository');
const bcrypt = require('bcryptjs');
const { transaction, run } = require('../database');

const BCRYPT_ROUNDS = 12;

function assertTenantAccess(reqUser, tenantId) {
  if (reqUser?.role === 'superadmin') return true;
  if (String(tenantId || '') === String(reqUser?.tenantId || '')) return true;
  const err = new Error('Acesso negado ao tenant informado');
  err.statusCode = 403;
  err.code = 'TENANT_FORBIDDEN';
  throw err;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome || '',
    email: row.email || '',
    role: row.role || 'gestor',
    tenant_id: row.tenant_id || 'default',
    created_at: row.created_at || '',
    last_login: row.last_login || null,
    updated_at: row.updated_at || '',
  };
}

async function listUsers(tenantId, reqUser) {
  assertTenantAccess(reqUser, tenantId);
  const users = tenantRepository.findUsersByTenant(tenantId);
  return {
    success: true,
    users: users.map(mapUser),
    pending_invites: [],
  };
}

async function createUser(tenantId, { nome, email, password, role }, reqUser, ip) {
  const existing = authRepository.findUserByEmail(email);
  if (existing) {
    const err = new Error('E-mail já cadastrado');
    err.statusCode = 409;
    err.code = 'EMAIL_EXISTS';
    throw err;
  }

  const now = new Date().toISOString();
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  
  let userId;
  transaction(() => {
    userId = authRepository.createUser({
      nome,
      email,
      passwordHash: hash,
      role,
      tenantId,
      now,
    });
    auditRepository.insertAuditLog(reqUser?.id || null, 'ADMIN_CREATE_USER', { userId, email, role }, ip, tenantId);
  });

  const user = authRepository.findUserById(userId);
  return { success: true, user: mapUser(user) };
}

async function deleteUser(tenantId, userId, reqUser, ip) {
  assertTenantAccess(reqUser, tenantId);

  const uId = Number(userId);
  if (!Number.isInteger(uId) || uId <= 0) {
    const err = new Error('Usuário inválido');
    err.statusCode = 400;
    err.code = 'INVALID_USER';
    throw err;
  }

  const target = authRepository.findUserById(uId);
  if (!target || target.tenant_id !== tenantId) {
    const err = new Error('Usuário não encontrado');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  if (target.id === reqUser?.id && reqUser?.jti !== 'system') {
    const err = new Error('Você não pode remover seu próprio usuário');
    err.statusCode = 400;
    err.code = 'SELF_DELETE_BLOCKED';
    throw err;
  }

  if (target.role === 'admin') {
    const adminCount = tenantRepository.countAdminsByTenant(tenantId);
    if (adminCount <= 1) {
      const err = new Error('Mantenha pelo menos um administrador ativo');
      err.statusCode = 400;
      err.code = 'LAST_ADMIN_BLOCKED';
      throw err;
    }
  }

  transaction(() => {
    run('DELETE FROM refresh_tokens WHERE user_id = ?', [uId]);
    run('DELETE FROM revoked_tokens WHERE user_id = ?', [uId]);
    run('DELETE FROM auth WHERE id = ? AND tenant_id = ?', [uId, tenantId]);
    auditRepository.insertAuditLog(reqUser?.id || null, 'ADMIN_DELETE_USER', { userId: uId, email: target.email }, ip, tenantId);
  });

  return { success: true };
}

module.exports = {
  listUsers,
  createUser,
  deleteUser,
};
