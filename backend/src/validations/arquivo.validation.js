const { z } = require('zod');

const createArquivoSchema = z.object({
  id: z.string().optional(),
  dataImpressao: z.string().optional(),
  data_impressao: z.string().optional(),
  horaImpressao: z.string().optional(),
  hora_impressao: z.string().optional(),
  timestamp: z.number().optional(),
  contratos: z.array(z.any()).default([]),
}).passthrough();

module.exports = {
  createArquivoSchema,
};
