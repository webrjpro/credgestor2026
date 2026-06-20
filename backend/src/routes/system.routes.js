const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenant } = require('../middleware/tenant');
const systemController = require('../controllers/system.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.get('/state', systemController.getSystemState);
router.post('/state', systemController.restoreSystemState);
router.post('/reset', systemController.resetSystem);
router.post('/retention', systemController.runRetentionPolicy);
router.get('/health', systemController.getHealth);
router.get('/credentials', systemController.getCredentials);
router.get('/db-stats', systemController.getDbStats);
router.get('/audit-logs', systemController.getAuditLogs);
router.post('/sqlite-backup', systemController.sqliteBackup);
router.post('/reset-credentials', systemController.resetCredentials);

module.exports = router;
