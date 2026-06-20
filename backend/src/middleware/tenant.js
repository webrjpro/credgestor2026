/**
 * Middleware de Multi-tenancy
 *
 * Garante isolamento de dados entre tenants (inquilinos).
 *
 * Estratégia: Shared Database, Shared Schema (tenant_id em cada tabela)
 * — Maior eficiência de custos para SaaS pequeno/médio
 * — Isolamento via WHERE tenant_id = ? em todas as queries
 *
 * Fluxo:
 * 1. authenticate() extrai user.tenantId do JWT
 * 2. tenant() valida se o tenant existe e está ativo
 * 3. Injeta req.tenantId para uso nas rotas
 */
const { queryOne } = require('../database');

/**
 * Middleware que valida e injeta o tenant_id na requisição.
 * Deve ser usado APÓS o middleware authenticate.
 */
function tenant(req, res, next) {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({
      error: 'Tenant não identificado',
      code: 'MISSING_TENANT',
    });
  }

  // Verificar se o tenant existe e está ativo
  const tenantRecord = queryOne('SELECT * FROM tenants WHERE id = ? AND status = ?', [tenantId, 'ativo']);
  if (!tenantRecord) {
    // Se for o tenant 'default' e não existir no banco, deixar passar (bootstrap)
    if (tenantId === 'default') {
      req.tenantId = 'default';
      req.tenant = { id: 'default', nome: 'Default', plano: 'enterprise', status: 'ativo' };
      return next();
    }
    return res.status(403).json({
      error: 'Tenant não encontrado ou inativo',
      code: 'TENANT_INACTIVE',
    });
  }

  // Verificar limites do plano
  if (tenantRecord.plano !== 'enterprise') {
    const limits = getPlanLimits(tenantRecord.plano);

    if (limits.maxUsers) {
      const userCount = queryOne(
        'SELECT COUNT(*) as c FROM auth WHERE tenant_id = ?', [tenantId]
      );
      if (userCount.c > limits.maxUsers) {
        // Não bloquear, apenas avisar no header
        res.set('X-Tenant-Warning', 'user_limit_exceeded');
      }
    }
  }

  req.tenantId = tenantId;
  req.tenant = tenantRecord;
  next();
}

/**
 * Middleware de admin — requer role 'admin' ou 'superadmin'
 */
function requireAdmin(req, res, next) {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Acesso restrito a administradores',
      code: 'ADMIN_REQUIRED',
    });
  }
  next();
}

/**
 * Middleware de superadmin — acesso cross-tenant
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({
      error: 'Acesso restrito a super administradores',
      code: 'SUPERADMIN_REQUIRED',
    });
  }
  next();
}

/**
 * Limites por plano
 */
function getPlanLimits(plano) {
  const plans = {
    free: {
      maxUsers: 1,
      maxClientes: 50,
      maxEmprestimos: 100,
      features: ['basic_crud', 'reports_basic'],
    },
    starter: {
      maxUsers: 3,
      maxClientes: 200,
      maxEmprestimos: 500,
      features: ['basic_crud', 'reports_basic', 'export_pdf', 'export_excel'],
    },
    professional: {
      maxUsers: 10,
      maxClientes: 1000,
      maxEmprestimos: 5000,
      features: ['basic_crud', 'reports_advanced', 'export_pdf', 'export_excel', 'backup_auto', 'api_access'],
    },
    enterprise: {
      maxUsers: null, // ilimitado
      maxClientes: null,
      maxEmprestimos: null,
      features: ['all'],
    },
  };
  return plans[plano] || plans.free;
}

/**
 * Middleware para verificar limites do plano ao criar recursos.
 * Busca o tenant diretamente do banco para não depender do middleware tenant().
 */
function checkPlanLimit(resourceType) {
  return (req, res, next) => {
    const tenantId = req.tenantId || req.user?.tenantId || 'default';
    const tenantRecord = req.tenant || queryOne('SELECT * FROM tenants WHERE id = ?', [tenantId]);

    if (!tenantRecord || tenantRecord.plano === 'enterprise') return next();

    const limits = getPlanLimits(tenantRecord.plano);
    let currentCount = 0;
    let maxCount = null;

    if (resourceType === 'clientes' && limits.maxClientes) {
      currentCount = queryOne('SELECT COUNT(*) as c FROM clientes WHERE tenant_id = ?', [tenantId]).c;
      maxCount = limits.maxClientes;
    } else if (resourceType === 'emprestimos' && limits.maxEmprestimos) {
      currentCount = queryOne('SELECT COUNT(*) as c FROM emprestimos WHERE tenant_id = ?', [tenantId]).c;
      maxCount = limits.maxEmprestimos;
    } else if (resourceType === 'users' && limits.maxUsers) {
      currentCount = queryOne('SELECT COUNT(*) as c FROM auth WHERE tenant_id = ?', [tenantId]).c;
      maxCount = limits.maxUsers;
    }

    if (maxCount !== null && currentCount >= maxCount) {
      return res.status(403).json({
        error: `Limite do plano ${tenantRecord.plano} atingido: máximo de ${maxCount} ${resourceType}`,
        code: 'PLAN_LIMIT_EXCEEDED',
        limit: maxCount,
        current: currentCount,
        upgrade_url: '/api/tenants/upgrade',
      });
    }

    next();
  };
}

module.exports = {
  tenant,
  requireAdmin,
  requireSuperAdmin,
  getPlanLimits,
  checkPlanLimit,
};
