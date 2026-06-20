const bcrypt = require('bcryptjs');
const authRepository = require('../repositories/auth.repository');
const tenantRepository = require('../repositories/tenant.repository');
const caixaRepository = require('../repositories/caixa.repository');
const { transaction } = require('../database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');

const BCRYPT_ROUNDS = 12;

async function register({ nome, email, password }) {
  let resultUser = null;
  let accessToken = '';
  let refreshToken = '';

  // bcrypt é async — deve rodar FORA da transaction síncrona do better-sqlite3
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  transaction(() => {
    // Verificar duplicidade
    const existing = authRepository.findUserByEmail(email);
    if (existing) {
      const err = new Error('E-mail já cadastrado');
      err.statusCode = 409;
      err.code = 'EMAIL_EXISTS';
      throw err;
    }

    const now = new Date().toISOString();

    // Primeiro usuário é admin do tenant 'default'
    const userCount = authRepository.getUserCount();
    const isFirstUser = userCount === 0;
    const role = isFirstUser ? 'admin' : 'gestor';
    let tenantId = isFirstUser ? 'default' : null;

    if (isFirstUser) {
      const existingTenant = tenantRepository.findTenantById('default');
      if (!existingTenant) {
        tenantRepository.createTenant({
          id: 'default',
          nome: 'CredGestor',
          slug: 'credgestor',
          plano: 'enterprise',
          status: 'ativo',
          now,
        });
        caixaRepository.updateSaldo('default', 0, now);
      }
    }

    const userId = authRepository.createUser({
      nome,
      email,
      passwordHash,
      role,
      tenantId,
      now,
    });

    const user = authRepository.findUserById(userId);
    resultUser = user;

    accessToken = generateAccessToken(user);
    refreshToken = generateRefreshToken(user);

    // Salvar refresh token
    const refreshPayload = verifyRefreshToken(refreshToken);
    const expiresAt = new Date(refreshPayload.exp * 1000).toISOString();
    authRepository.saveRefreshToken(userId, refreshToken, expiresAt);
  });

  return {
    user: resultUser,
    accessToken,
    refreshToken,
  };
}

async function login({ email, password }) {
  const user = authRepository.findUserByEmail(email);
  if (!user) {
    const err = new Error('Credenciais inválidas');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const err = new Error('Credenciais inválidas');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const now = new Date().toISOString();
  authRepository.updateLastLogin(user.id, now);

  const refreshPayload = verifyRefreshToken(refreshToken);
  const expiresAt = new Date(refreshPayload.exp * 1000).toISOString();
  authRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

  return {
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
    },
    accessToken,
    refreshToken,
  };
}

async function refresh(token) {
  const payload = verifyRefreshToken(token);
  if (!payload) {
    const err = new Error('Refresh token inválido ou expirado');
    err.statusCode = 401;
    err.code = 'INVALID_REFRESH_TOKEN';
    throw err;
  }

  const stored = authRepository.findRefreshToken(token);
  if (!stored) {
    const err = new Error('Refresh token revogado');
    err.statusCode = 401;
    err.code = 'REFRESH_TOKEN_REVOKED';
    throw err;
  }

  const user = authRepository.findUserById(payload.sub);
  if (!user) {
    const err = new Error('Usuário não encontrado');
    err.statusCode = 401;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    tenant_id: user.tenant_id,
  });

  return { accessToken };
}

async function logout(refreshToken, accessTokenJti, accessTokenExp, userId) {
  if (refreshToken) {
    authRepository.deleteRefreshToken(refreshToken);
  }
  if (accessTokenJti) {
    const expIso = accessTokenExp
      ? new Date(accessTokenExp * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    authRepository.saveRevokedToken(accessTokenJti, userId, expIso);
  }
  return { success: true };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = authRepository.findUserById(userId);
  if (!user) {
    const err = new Error('Usuário não encontrado');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  // Obter hash completo do bd
  const fullUser = authRepository.findUserByEmail(user.email);
  const match = await bcrypt.compare(currentPassword, fullUser.password_hash);
  if (!match) {
    const err = new Error('Senha atual incorreta');
    err.statusCode = 400;
    err.code = 'INVALID_CURRENT_PASSWORD';
    throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const now = new Date().toISOString();
  authRepository.updatePassword(userId, passwordHash, now);

  return { success: true };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword,
};
