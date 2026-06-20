/**
 * Middleware de autenticação JWT
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { queryOne, run } = require('../database');

// JWT_SECRET é injetado pelo processo pai (Electron) via env ao spawnar o backend.
// Resolvido a cada chamada (lazy) para tolerar delay de propagação do env no Windows.
const MIN_JWT_SECRET_LENGTH = 32;

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (secret.length >= MIN_JWT_SECRET_LENGTH) {
    return secret;
  }
  throw new Error(`JWT_SECRET ausente ou menor que ${MIN_JWT_SECRET_LENGTH} caracteres`);
}

function assertAuthSecrets() {
  getJwtSecret();
}

/**
 * Middleware que exige token JWT válido.
 * Injeta req.user = { id, email, role, tenantId }
 */
function authenticate(req, res, next) {
  // Autenticação direta e segura para chamadas internas do Electron principal (loopback)
  const systemKey = req.headers['x-system-key'];
  if (systemKey && process.env.SYSTEM_API_KEY && systemKey === process.env.SYSTEM_API_KEY) {
    req.user = {
      id: 1,
      email: 'gestor@empresa.com',
      role: 'admin',
      tenantId: 'default',
      jti: 'system',
      exp: null
    };
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret());

    // Bloqueia tokens revogados (logout).
    if (payload.jti) {
      try {
        const revoked = queryOne('SELECT jti FROM revoked_tokens WHERE jti = ?', [payload.jti]);
        if (revoked) {
          return res.status(401).json({ error: 'Token revogado', code: 'TOKEN_REVOKED' });
        }
      } catch (_) { /* tabela ainda não migrada — fail-open para não travar bootstrap */ }
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'gestor',
      tenantId: payload.tenantId || null,
      jti: payload.jti || null,
      exp: payload.exp || null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Middleware que exige role específica.
 * @param  {...string} roles Roles permitidas (ex: 'admin', 'gestor')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado. Role necessária: ' + roles.join(', ') });
    }
    next();
  };
}

/**
 * Gera access token JWT (com jti para revogação).
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || 'gestor',
      tenantId: user.tenant_id || null,
      jti: crypto.randomUUID(),
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

/**
 * Gera refresh token JWT.
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh', jti: crypto.randomUUID() },
    getJwtSecret(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

/**
 * Verifica refresh token.
 */
function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (payload.type !== 'refresh') return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Revoga (blacklist) um access token pelo jti+exp.
 * Persiste apenas o jti (não o token completo).
 */
function revokeAccessToken(jti, expSeconds, userId) {
  if (!jti) return;
  try {
    const expIso = expSeconds
      ? new Date(expSeconds * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    run(
      'INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at) VALUES (?, ?, ?)',
      [jti, userId || null, expIso]
    );
  } catch (err) {
    console.error('[AUTH] Falha ao revogar token:', err.message);
  }
}

/**
 * Limpa entradas expiradas do blacklist.
 */
function cleanupRevokedTokens() {
  try {
    run('DELETE FROM revoked_tokens WHERE expires_at < ?', [new Date().toISOString()]);
  } catch (_) { /* tabela pode não existir no bootstrap */ }
}

module.exports = {
  authenticate,
  authorize,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeAccessToken,
  cleanupRevokedTokens,
  getJwtSecret,
  assertAuthSecrets,
};
