const { z } = require('zod');

const registerSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('E-mail inválido').max(255).transform(v => v.toLowerCase().trim()),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(128),
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido').transform(v => v.toLowerCase().trim()),
  password: z.string().min(1, 'Senha obrigatória').max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres').max(128),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
};
