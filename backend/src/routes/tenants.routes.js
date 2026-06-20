const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenant, requireAdmin } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { createUserSchema } = require('../validations/tenant.validation');
const tenantController = require('../controllers/tenant.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);
router.use(requireAdmin);

router.get('/:tenantId/users', tenantController.listUsers);
router.post('/create-user', validate(createUserSchema), tenantController.createUser);
router.delete('/:tenantId/users/:userId', tenantController.deleteUser);

module.exports = router;
