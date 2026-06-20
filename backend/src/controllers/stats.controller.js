const statsService = require('../services/stats.service');

async function getAggregates(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await statsService.getAggregates(tenantId);
    return res.json(result);
  } catch (err) {
    console.error('[STATS CONTROLLER] Erro ao obter agregações do dashboard:', err);
    return res.status(500).json({ error: 'Erro ao obter agregações do dashboard' });
  }
}

async function getDashboardStats(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await statsService.getDashboardStats(tenantId);
    return res.json(result);
  } catch (err) {
    console.error('[STATS CONTROLLER] Erro ao obter estatísticas:', err);
    return res.status(500).json({ error: 'Erro ao gerar estatísticas' });
  }
}

async function getCharts(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await statsService.getCharts(tenantId);
    return res.json(result);
  } catch (err) {
    console.error('[STATS CONTROLLER] Erro nos gráficos:', err);
    return res.status(500).json({ error: 'Erro ao gerar dados de gráficos' });
  }
}

module.exports = {
  getAggregates,
  getDashboardStats,
  getCharts,
};
