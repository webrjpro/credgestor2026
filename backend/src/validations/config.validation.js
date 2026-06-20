const { z } = require('zod');

const updateConfigSchema = z.record(z.string(), z.any()).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'Pelo menos uma configuração é necessária' }
);

module.exports = {
  updateConfigSchema,
};
