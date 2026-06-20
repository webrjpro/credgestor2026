const { z } = require('zod');

const ajustarSaldoSchema = z.object({
  saldo: z.number(),
}).passthrough();

const movimentacaoSchema = z.object({
  tipo: z.enum(['entrada', 'saida']).default('entrada'),
  valor: z.number().positive(),
  descricao: z.string().max(500).default(''),
  data: z.string().default(() => new Date().toISOString().split('T')[0]),
}).passthrough();

const historicoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(10000),
  tipo: z.string().optional().default(''),
  from: z.string().optional(),
  to: z.string().optional(),
});

module.exports = {
  ajustarSaldoSchema,
  movimentacaoSchema,
  historicoQuerySchema,
};
