const authService = require('../services/auth.service');
const auditRepository = require('../repositories/audit.repository');

async function register(req, res) {
  try {
    const { nome, email, password } = req.body;
    const result = await authService.register({ nome, email, password });
    
    auditRepository.insertAuditLog(
      result.user.id,
      'REGISTER_GESTOR',
      { email },
      req.ip,
      result.user.tenant_id
    );

    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[AUTH CONTROLLER] Erro no registro:', err);
    return res.status(500).json({ error: 'Erro ao registrar gestor' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    auditRepository.insertAuditLog(
      result.user.id,
      'LOGIN',
      { email },
      req.ip,
      result.user.tenantId
    );

    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[AUTH CONTROLLER] Erro no login:', err);
    return res.status(500).json({ error: 'Erro ao autenticar' });
  }
}

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[AUTH CONTROLLER] Erro no refresh:', err);
    return res.status(500).json({ error: 'Erro ao renovar token' });
  }
}

async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    const accessTokenJti = req.user?.jti;
    const accessTokenExp = req.user?.exp;
    const userId = req.user?.id;

    await authService.logout(refreshToken, accessTokenJti, accessTokenExp, userId);

    if (userId) {
      auditRepository.insertAuditLog(
        userId,
        'LOGOUT',
        { email: req.user.email },
        req.ip,
        req.user.tenantId
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[AUTH CONTROLLER] Erro no logout:', err);
    return res.status(500).json({ error: 'Erro ao encerrar sessão' });
  }
}

async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId || 'default';
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(userId, { currentPassword, newPassword });

    auditRepository.insertAuditLog(
      userId,
      'CHANGE_PASSWORD',
      { success: true },
      req.ip,
      tenantId
    );

    return res.json({ success: true });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[AUTH CONTROLLER] Erro na troca de senha:', err);
    return res.status(500).json({ error: 'Erro ao trocar senha' });
  }
}

async function me(req, res) {
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      tenantId: req.user.tenantId,
    }
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword,
  me,
};
