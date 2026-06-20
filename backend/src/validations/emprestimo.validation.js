const { z } = require('zod');

const createEmprestimoSchema = z.object({
  id: z.string().max(100).optional(),
  clienteId: z.string().optional(),
  cliente_id: z.string().optional(),
  valor: z.number().positive('Valor deve ser positivo').optional(),
  valorOriginal: z.number().positive().optional(),
  tipo: z.string().max(50).default('parcelado'),
  taxa: z.number().min(0).default(0),
  taxaJuros: z.number().min(0).optional(),
  parcelas: z.union([z.number().int().min(1), z.array(z.any())]).default(1),
  parcelasPagas: z.number().int().min(0).optional().default(0),
  parcelas_pagas: z.number().int().min(0).optional(),
  valorParcela: z.number().min(0).optional().default(0),
  valor_parcela: z.number().min(0).optional(),
  dataInicio: z.string().optional(),
  data_inicio: z.string().optional(),
  dataVencimento: z.string().optional().default(''),
  data_vencimento: z.string().optional(),
  status: z.string().max(20).default('ativo'),
  statusGeral: z.string().max(20).optional(),
  historicoPagamentos: z.any().optional(),
  historico_pagamentos: z.any().optional(),
  obs: z.string().max(5000).default(''),
  plano: z.any().optional(),
  multaDiaria: z.number().min(0).optional(),
  multaFixa: z.number().min(0).optional(),
  carenciaDias: z.number().int().min(0).optional(),
  valorTotal: z.number().min(0).optional(),
  gestorResponsavel: z.string().optional(),
  liberadoPor: z.any().optional(),
  aprovacao: z.string().optional(),
}).passthrough();

const updateEmprestimoSchema = createEmprestimoSchema.partial();

const pagarSchema = z.object({
  valor: z.number().positive('Valor deve ser positivo'),
  metodo: z.string().max(50).default('dinheiro'),
  observacao: z.string().max(500).default(''),
  parcelas: z.array(z.any()).optional(),
  historicoPagamentos: z.array(z.any()).optional(),
  historico_pagamentos: z.array(z.any()).optional(),
  status: z.string().max(20).optional(),
  statusGeral: z.string().max(20).optional(),
  pagouComMulta: z.boolean().optional(),
  scoreEventos: z.array(z.object({
    pagouComMulta: z.boolean().optional(),
    comMulta: z.boolean().optional(),
  }).passthrough()).optional(),
}).passthrough();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(10000),
  status: z.string().optional().default(''),
  cliente_id: z.string().optional(),
  clienteId: z.string().optional(),
  orderBy: z.enum(['created_at', 'valor', 'data_vencimento', 'status', 'data_inicio']).default('data_inicio'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

module.exports = {
  createEmprestimoSchema,
  updateEmprestimoSchema,
  pagarSchema,
  listQuerySchema,
};
