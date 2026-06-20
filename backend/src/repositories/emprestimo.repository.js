const { queryOne, queryAll, run } = require('../database');

function findEmprestimoById(id, tenantId) {
  return queryOne('SELECT * FROM emprestimos WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

function listEmprestimos({ tenantId, status, clienteId, col, dir, limit, offset }) {
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (clienteId) {
    where += ' AND cliente_id = ?';
    params.push(clienteId);
  }

  return queryAll(
    `SELECT * FROM emprestimos ${where} ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

function countEmprestimos({ tenantId, status, clienteId }) {
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (clienteId) {
    where += ' AND cliente_id = ?';
    params.push(clienteId);
  }

  const row = queryOne(`SELECT COUNT(*) as total FROM emprestimos ${where}`, params);
  return row ? row.total : 0;
}

function createEmprestimo(e) {
  return run(
    `INSERT INTO emprestimos (id, cliente_id, valor, tipo, taxa, parcelas, parcelas_pagas, valor_parcela, data_inicio, data_vencimento, status, historico_pagamentos, obs, plano, tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.id, e.cliente_id, e.valor, e.tipo, e.taxa, e.parcelas, e.parcelas_pagas,
      e.valor_parcela, e.data_inicio, e.data_vencimento, e.status, e.historico_pagamentos,
      e.obs, e.plano, e.tenant_id, e.created_at, e.updated_at
    ]
  );
}

function updateEmprestimo(id, tenantId, e) {
  return run(
    `UPDATE emprestimos
     SET cliente_id = ?, valor = ?, tipo = ?, taxa = ?, parcelas = ?, parcelas_pagas = ?,
         valor_parcela = ?, data_inicio = ?, data_vencimento = ?, status = ?,
         historico_pagamentos = ?, obs = ?, plano = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      e.cliente_id, e.valor, e.tipo, e.taxa, e.parcelas, e.parcelas_pagas,
      e.valor_parcela, e.data_inicio, e.data_vencimento, e.status,
      e.historico_pagamentos, e.obs, e.plano, e.updated_at,
      id, tenantId
    ]
  );
}

function deleteEmprestimo(id, tenantId) {
  return run('DELETE FROM emprestimos WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

module.exports = {
  findEmprestimoById,
  listEmprestimos,
  countEmprestimos,
  createEmprestimo,
  updateEmprestimo,
  deleteEmprestimo,
};
