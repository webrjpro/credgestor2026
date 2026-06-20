const { z } = require('zod');

const createTransacaoSchema = z.object({
  id: z.string().max(100).optional(),
  tipo: z.string().max(50).default('entrada'),
  descricao: z.string().max(500).default(''),
  valor: z.number().positive('Valor deve ser positivo'),
  data: z.string().default(() => new Date().toISOString().split('T')[0]),
  referenciaId: z.string().optional(),
  referencia_id: z.string().optional(),
  clienteNome: z.string().optional(),
  cliente_nome: z.string().optional(),
}).passthrough();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(10000),
  tipo: z.string().optional(),
  referenciaId: z.string().optional(),
  referencia_id: z.string().optional(),
  clienteId: z.string().optional(),
  cliente_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

module.exports = {
  createTransacaoSchema,
  listQuerySchema,
};
