const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenant } = require('../middleware/tenant');
const statsController = require('../controllers/stats.controller');

const router = express.Router();
router.use(authenticate);
router.use(tenant);

router.get('/aggregates', statsController.getAggregates);
router.get('/', statsController.getDashboardStats);
router.get('/charts', statsController.getCharts);

module.exports = router;
