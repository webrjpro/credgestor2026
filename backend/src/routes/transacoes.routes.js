const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { tenant } = require('../middleware/tenant');
const { createTransacaoSchema, listQuerySchema } = require('../validations/transacao.validation');
const transacaoController = require('../controllers/transacao.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.get('/', validate(listQuerySchema, 'query'), transacaoController.listTransacoes);
router.get('/:id', transacaoController.getTransacao);
router.post('/', validate(createTransacaoSchema), transacaoController.createTransacao);
router.post('/batch', transacaoController.batchCreateTransacoes);
router.delete('/:id', transacaoController.deleteTransacao);

module.exports = router;
