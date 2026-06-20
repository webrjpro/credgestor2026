const { queryOne, queryAll, run } = require('../database');

function listArquivos(tenantId) {
  return queryAll(
    'SELECT * FROM arquivo_aprovados WHERE tenant_id = ? ORDER BY timestamp DESC',
    [tenantId]
  );
}

function findArquivoById(id, tenantId) {
  return queryOne(
    'SELECT * FROM arquivo_aprovados WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
}

function createArquivo({ id, dataImpressao, horaImpressao, timestamp, contratos, tenantId, createdAt }) {
  return run(
    `INSERT INTO arquivo_aprovados (id, data_impressao, hora_impressao, timestamp, contratos, tenant_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, dataImpressao, horaImpressao, timestamp, contratos, tenantId, createdAt]
  );
}

function deleteArquivo(id, tenantId) {
  return run(
    'DELETE FROM arquivo_aprovados WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
}

module.exports = {
  listArquivos,
  findArquivoById,
  createArquivo,
  deleteArquivo,
};
