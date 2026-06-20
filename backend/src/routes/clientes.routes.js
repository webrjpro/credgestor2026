const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { tenant, checkPlanLimit } = require('../middleware/tenant');
const {
  createClienteSchema,
  updateClienteSchema,
  blacklistSchema,
  listQuerySchema,
} = require('../validations/cliente.validation');
const clienteController = require('../controllers/cliente.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.get('/', validate(listQuerySchema, 'query'), clienteController.listClientes);
router.get('/check-matricula', clienteController.checkMatricula);
router.put('/:id/blacklist', validate(blacklistSchema), clienteController.setBlacklist);
router.get('/:id', clienteController.getCliente);
router.post('/', validate(createClienteSchema), checkPlanLimit('clientes'), clienteController.createCliente);
router.post('/batch', checkPlanLimit('clientes'), clienteController.batchCreateClientes);
router.put('/:id', validate(updateClienteSchema), clienteController.updateCliente);
router.delete('/:id', clienteController.deleteCliente);

module.exports = router;
