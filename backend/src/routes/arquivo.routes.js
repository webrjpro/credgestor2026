const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { tenant } = require('../middleware/tenant');
const { createArquivoSchema } = require('../validations/arquivo.validation');
const arquivoController = require('../controllers/arquivo.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.get('/', arquivoController.listArquivos);
router.get('/:id', arquivoController.getArquivo);
router.post('/', validate(createArquivoSchema), arquivoController.createArquivo);
router.delete('/:id', arquivoController.deleteArquivo);

module.exports = router;
