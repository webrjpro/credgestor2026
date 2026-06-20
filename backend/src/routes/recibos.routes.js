const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { tenant } = require('../middleware/tenant');
const {
  criarRecibosSchema,
  entregarReciboSchema,
  estornarReciboSchema,
} = require('../validations/recibo.validation');
const reciboController = require('../controllers/recibo.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.post('/criar', validate(criarRecibosSchema), reciboController.criarRecibos);
router.get('/arquivo/:arquivoId', reciboController.listRecibosByArquivo);
router.get('/pendentes', reciboController.listRecibosPendentes);
router.get('/:id', reciboController.getRecibo);
router.put('/:id/entregar', validate(entregarReciboSchema), reciboController.entregarRecibo);
router.put('/:id/estornar', validate(estornarReciboSchema), reciboController.estornarRecibo);

module.exports = router;
