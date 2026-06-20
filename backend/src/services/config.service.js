const configRepository = require('../repositories/config.repository');
const { transaction } = require('../database');

const DEFAULT_TENANT = 'default';

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
}

async function getConfig(key, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const row = configRepository.findConfigByKey(key, safeTenant);
  if (!row) return null;
  return { chave: row.chave, valor: row.valor };
}

async function listConfigs(tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const rows = configRepository.listConfigs(safeTenant);
  const result = {};
  for (const row of rows) {
    result[row.chave] = row.valor;
  }
  return result;
}

async function saveConfigs(tenantId, body) {
  const safeTenant = normalizeTenantId(tenantId);
  const now = new Date().toISOString();

  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    const err = new Error('Corpo deve conter pelo menos uma configuração');
    err.statusCode = 400;
    err.code = 'INVALID_CONFIG_BODY';
    throw err;
  }

  transaction(() => {
    for (const [chave, valor] of Object.entries(body)) {
      const valorStr = typeof valor === 'string' ? valor : JSON.stringify(valor);
      configRepository.saveConfig(chave, valorStr, safeTenant, now);
    }
  });

  return listConfigs(safeTenant);
}

async function saveConfig(key, value, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const now = new Date().toISOString();
  const valorStr = typeof value === 'string' ? value : JSON.stringify(value);
  configRepository.saveConfig(key, valorStr, safeTenant, now);
  return { chave: key, valor: valorStr };
}

module.exports = {
  getConfig,
  listConfigs,
  saveConfigs,
  saveConfig,
};
