const { z } = require('zod');

const ROLES = ['admin', 'gestor', 'viewer'];

const createUserSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('E-mail inválido').max(255).transform(v => v.toLowerCase().trim()),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(128),
  role: z.enum(ROLES).default('gestor'),
});

module.exports = {
  createUserSchema,
  ROLES,
};
