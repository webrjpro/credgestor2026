const { z } = require('zod');

const createClienteSchema = z.object({
  id: z.string().max(100).optional(),
  nome: z.string().min(1, 'Nome obrigatório').max(500),
  matricula: z.string().max(100).optional().default(''),
  cpf: z.string().max(20).default(''),
  dataNascimento: z.string().max(10).optional().default(''),
  data_nascimento: z.string().max(10).optional(),
  telefone: z.string().max(20).default(''),
  email: z.string().max(255).default(''),
  limite: z.number().min(0).default(2000),
  tipoLimite: z.string().max(20).optional().default('total'),
  tipo_limite: z.string().max(20).optional(),
  diaVencimento: z.string().max(10).optional().default(''),
  dia_vencimento: z.string().max(10).optional(),
  obs: z.string().max(5000).default(''),
  status: z.string().max(20).default('ativo'),
  dataCadastro: z.string().max(20).optional(),
  data_cadastro: z.string().max(20).optional(),
  scoreManual: z.number().int().nullable().optional().default(null),
  score_manual: z.number().int().nullable().optional(),
  scoreGestor: z.number().int().nullable().optional().default(null),
  score_gestor: z.number().int().nullable().optional(),
  foto: z.string().optional().default(''),
  tipoPagamento: z.string().max(50).optional().default(''),
  tipo_pagamento: z.string().max(50).optional(),
  banco: z.string().max(100).optional().default(''),
  agencia: z.string().max(20).optional().default(''),
  conta: z.string().max(30).optional().default(''),
  chavePix: z.string().max(254).optional().default(''),
  chave_pix: z.string().max(254).optional(),
  operacao: z.string().max(20).optional().default(''),
  scoreCredito: z.number().int().min(0).max(1000).optional().default(500),
  score_credito: z.number().int().min(0).max(1000).optional(),
  pagamentosEmDia: z.number().int().min(0).optional().default(0),
  pagamentos_em_dia: z.number().int().min(0).optional(),
  blacklist: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional().default(false),
  motivoBloqueio: z.string().max(100).optional().default(''),
  motivo_bloqueio: z.string().max(100).optional(),
  contatos: z.union([z.string(), z.array(z.any())]).optional().default('[]'),
}).passthrough();

const updateClienteSchema = createClienteSchema.partial();

const blacklistSchema = z.object({
  blocked: z.boolean(),
  motivo: z.string().max(100).optional().default('manual'),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(10000),
  search: z.string().max(200).optional(),
  status: z.string().max(20).optional(),
  orderBy: z.enum(['nome', 'created_at', 'data_cadastro', 'limite']).default('nome'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

module.exports = {
  createClienteSchema,
  updateClienteSchema,
  blacklistSchema,
  listQuerySchema,
};
