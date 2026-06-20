const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { tenant } = require('../middleware/tenant');
const { ajustarSaldoSchema, movimentacaoSchema, historicoQuerySchema } = require('../validations/caixa.validation');
const caixaController = require('../controllers/caixa.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.get('/', caixaController.getResumo);
router.put('/', validate(ajustarSaldoSchema), caixaController.ajustarSaldo);
router.put('/saldo', validate(ajustarSaldoSchema), caixaController.ajustarSaldo);
router.get('/historico', validate(historicoQuerySchema, 'query'), caixaController.listHistorico);
router.post('/historico', validate(movimentacaoSchema), caixaController.recordMovement);

module.exports = router;
