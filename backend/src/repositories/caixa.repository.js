const { queryOne, queryAll, run } = require('../database');

function findCaixa(tenantId) {
  return queryOne('SELECT * FROM caixa WHERE tenant_id = ?', [tenantId]);
}

function createCaixa(tenantId, saldo, updatedAt) {
  return run('INSERT INTO caixa (tenant_id, saldo, updated_at) VALUES (?, ?, ?)', [tenantId, saldo, updatedAt]);
}

function updateSaldo(tenantId, saldo, updatedAt) {
  return run(
    `INSERT INTO caixa (tenant_id, saldo, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET saldo = excluded.saldo, updated_at = excluded.updated_at`,
    [tenantId, saldo, updatedAt]
  );
}

function updateSaldoSimple(tenantId, saldo, updatedAt) {
  return run('UPDATE caixa SET saldo = ?, updated_at = ? WHERE tenant_id = ?', [saldo, updatedAt, tenantId]);
}

function insertHistorico({ tipo, valor, descricao, data, saldoAnterior, saldoPosterior, tenantId, createdAt }) {
  const result = run(
    `INSERT INTO caixa_historico (tipo, valor, descricao, data, saldo_anterior, saldo_posterior, tenant_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tipo, valor, descricao, data, saldoAnterior, saldoPosterior, tenantId, createdAt]
  );
  return result.lastInsertRowid;
}

function getHistoricoById(id) {
  return queryOne('SELECT * FROM caixa_historico WHERE id = ?', [id]);
}

function listHistorico({ tenantId, offset, limit, tipo, from, to }) {
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (tipo) { where += ' AND tipo = ?'; params.push(tipo); }
  if (from) { where += ' AND data >= ?'; params.push(from); }
  if (to) { where += ' AND data <= ?'; params.push(to); }

  return queryAll(
    `SELECT * FROM caixa_historico ${where} ORDER BY data DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

function countHistorico({ tenantId, tipo, from, to }) {
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (tipo) { where += ' AND tipo = ?'; params.push(tipo); }
  if (from) { where += ' AND data >= ?'; params.push(from); }
  if (to) { where += ' AND data <= ?'; params.push(to); }

  const row = queryOne(`SELECT COUNT(*) as total FROM caixa_historico ${where}`, params);
  return row ? row.total : 0;
}

function getCaixaAggregateTotals(tenantId) {
  const entradas = queryOne(
    "SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = 'entrada' AND tenant_id = ?",
    [tenantId]
  );
  const saidas = queryOne(
    "SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = 'saida' AND tenant_id = ?",
    [tenantId]
  );
  const emprestimosAtivos = queryOne(
    "SELECT COUNT(*) as count, COALESCE(SUM(valor), 0) as total FROM emprestimos WHERE status IN ('ativo', 'atrasado') AND tenant_id = ?",
    [tenantId]
  );

  return {
    totalEntradas: Number(entradas?.total || 0),
    totalSaidas: Number(saidas?.total || 0),
    emprestimosAtivosCount: Number(emprestimosAtivos?.count || 0),
    emprestimosAtivosTotal: Number(emprestimosAtivos?.total || 0),
  };
}

module.exports = {
  findCaixa,
  createCaixa,
  updateSaldo,
  updateSaldoSimple,
  insertHistorico,
  getHistoricoById,
  listHistorico,
  countHistorico,
  getCaixaAggregateTotals,
};
