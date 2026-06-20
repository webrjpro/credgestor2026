const arquivoRepository = require('../repositories/arquivo.repository');
const { generateId } = require('../utils/helpers');

const DEFAULT_TENANT = 'default';

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
}

function mapToFrontend(row) {
  if (!row) return null;
  let contratos = [];
  try {
    contratos = JSON.parse(row.contratos || '[]');
  } catch (error) {
    console.warn('[ARQUIVO SERVICE] contratos JSON invalido:', error.message);
  }
  return {
    id: String(row.id),
    dataImpressao: row.data_impressao || '',
    horaImpressao: row.hora_impressao || '',
    timestamp: row.timestamp || 0,
    contratos,
  };
}

async function listArquivos(tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const rows = arquivoRepository.listArquivos(safeTenant);
  return rows.map(mapToFrontend);
}

async function getArquivo(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const row = arquivoRepository.findArquivoById(id, safeTenant);
  if (!row) return null;
  return mapToFrontend(row);
}

async function createArquivo(tenantId, b) {
  const safeTenant = normalizeTenantId(tenantId);
  const now = new Date().toISOString();
  const id = (b.id || generateId()).toString();
  const dataImpressao = b.dataImpressao || b.data_impressao || now.split('T')[0];
  const horaImpressao = b.horaImpressao || b.hora_impressao || now.split('T')[1].split('.')[0];
  const timestamp = b.timestamp || Date.now();
  const contratos = JSON.stringify(b.contratos || []);

  arquivoRepository.createArquivo({
    id,
    dataImpressao,
    horaImpressao,
    timestamp,
    contratos,
    tenantId: safeTenant,
    createdAt: now,
  });

  const created = arquivoRepository.findArquivoById(id, safeTenant);
  return mapToFrontend(created);
}

async function deleteArquivo(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const existing = arquivoRepository.findArquivoById(id, safeTenant);
  if (!existing) {
    const err = new Error('Registro não encontrado');
    err.statusCode = 404;
    err.code = 'ARQUIVO_NOT_FOUND';
    throw err;
  }

  arquivoRepository.deleteArquivo(id, safeTenant);
  return { success: true };
}

module.exports = {
  listArquivos,
  getArquivo,
  createArquivo,
  deleteArquivo,
};
