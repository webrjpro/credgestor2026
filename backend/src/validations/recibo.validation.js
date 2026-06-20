const { z } = require('zod');

const criarRecibosSchema = z.object({
  arquivoId: z.string().max(100),
  contratos: z.array(z.object({
    empId: z.string().max(100).optional(),
    emprestimo_id: z.string().max(100).optional(),
    clienteId: z.string().max(100).optional(),
    cliente_id: z.string().max(100).optional(),
    clienteNome: z.string().max(200).optional(),
    clienteCpf: z.string().max(20).optional(),
    clienteTelefone: z.string().max(20).optional(),
    telefone: z.string().max(20).optional(),
    transferencia: z.string().max(500).optional(),
    valor: z.number().nonnegative(),
    parcelas: z.union([z.number().int().min(1), z.string()]),
  }).passthrough()).min(1),
});

const entregarReciboSchema = z.object({
  operadorNome: z.string().max(100).default(''),
  operadorEmail: z.string().max(100).default(''),
  pdfHash: z.string().max(256).optional().default(''),
  observacao: z.string().max(2000).optional().default(''),
});

const estornarReciboSchema = z.object({
  justificativa: z.string().min(2, 'Justificativa obrigatória').max(2000),
});

module.exports = {
  criarRecibosSchema,
  entregarReciboSchema,
  estornarReciboSchema,
};
