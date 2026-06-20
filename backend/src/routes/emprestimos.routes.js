const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { tenant, checkPlanLimit } = require('../middleware/tenant');
const {
  createEmprestimoSchema,
  updateEmprestimoSchema,
  pagarSchema,
  listQuerySchema,
} = require('../validations/emprestimo.validation');
const emprestimoController = require('../controllers/emprestimo.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.get('/', validate(listQuerySchema, 'query'), emprestimoController.listEmprestimos);
router.get('/:id', emprestimoController.getEmprestimo);
router.post('/', validate(createEmprestimoSchema), checkPlanLimit('emprestimos'), emprestimoController.createEmprestimo);
router.put('/:id', validate(updateEmprestimoSchema), emprestimoController.updateEmprestimo);
router.delete('/:id', emprestimoController.deleteEmprestimo);
router.post('/:id/pagar', validate(pagarSchema), emprestimoController.pagarEmprestimo);

module.exports = router;
