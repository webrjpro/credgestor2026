/**
 * Middleware de validação com Zod.
 *
 * Uso: router.post('/', validate(schema), handler)
 */
const { ZodError } = require('zod');

/**
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} source
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      // Coloca resultado validado em req.validated para query/params,
      // ou substitui req.body para body
      if (source === 'body') {
        req.body = parsed;
      } else {
        req.validated = parsed;
        // Também disponibiliza como req.query/req.params validados
        req[source] = { ...req[source], ...parsed };
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: err.errors.map(e => ({
            campo: e.path.join('.'),
            mensagem: e.message,
          })),
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
