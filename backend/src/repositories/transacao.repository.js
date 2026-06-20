const { queryOne, queryAll, run } = require('../database');

function findTransacaoById(id, tenantId) {
  return queryOne('SELECT * FROM transacoes WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

function listTransacoes({ tenantId, referenciaId, tipo, from, to, limit, offset }) {
  let where = 'WHERE t.tenant_id = ?';
  const params = [tenantId];

  if (referenciaId) { where += ' AND t.referencia_id = ?'; params.push(referenciaId); }
  if (tipo) { where += ' AND t.tipo = ?'; params.push(tipo); }
  if (from) { where += ' AND t.data >= ?'; params.push(from); }
  if (to) { where += ' AND t.data <= ?'; params.push(to); }

  return queryAll(
    `SELECT t.* FROM transacoes t
     ${where}
     ORDER BY t.data DESC, t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

function countTransacoes({ tenantId, referenciaId, tipo, from, to }) {
  let where = 'WHERE t.tenant_id = ?';
  const params = [tenantId];

  if (referenciaId) { where += ' AND t.referencia_id = ?'; params.push(referenciaId); }
  if (tipo) { where += ' AND t.tipo = ?'; params.push(tipo); }
  if (from) { where += ' AND t.data >= ?'; params.push(from); }
  if (to) { where += ' AND t.data <= ?'; params.push(to); }

  const row = queryOne(`SELECT COUNT(*) as total FROM transacoes t ${where}`, params);
  return row ? row.total : 0;
}

function createTransacao(t) {
  return run(
    `INSERT INTO transacoes (id, tipo, descricao, valor, data, referencia_id, cliente_nome, tenant_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.id, t.tipo, t.descricao, t.valor, t.data, t.referencia_id, t.cliente_nome, t.tenant_id, t.created_at]
  );
}

function deleteTransacao(id, tenantId) {
  return run('DELETE FROM transacoes WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

module.exports = {
  findTransacaoById,
  listTransacoes,
  countTransacoes,
  createTransacao,
  deleteTransacao,
};
