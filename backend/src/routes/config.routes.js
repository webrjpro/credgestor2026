const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { tenant } = require('../middleware/tenant');
const { updateConfigSchema } = require('../validations/config.validation');
const configController = require('../controllers/config.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.get('/', configController.listConfigs);
router.get('/:chave', configController.getConfig);
router.put('/', validate(updateConfigSchema), configController.saveConfigs);
router.put('/:chave', configController.saveConfig);

module.exports = router;
