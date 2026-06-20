const { queryOne, queryAll, run } = require('../database');

function findClienteById(id, tenantId) {
  return queryOne('SELECT * FROM clientes WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

function listClientes({ tenantId, search, status, col, dir, limit, offset }) {
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (search) {
    where += ' AND (nome LIKE ? OR matricula LIKE ? OR cpf LIKE ? OR telefone LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  return queryAll(
    `SELECT * FROM clientes ${where} ORDER BY ${col} COLLATE NOCASE ${dir} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

function countClientes({ tenantId, search, status }) {
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (search) {
    where += ' AND (nome LIKE ? OR matricula LIKE ? OR cpf LIKE ? OR telefone LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  const row = queryOne(`SELECT COUNT(*) as total FROM clientes ${where}`, params);
  return row ? row.total : 0;
}

function createCliente(c) {
  return run(
    `INSERT INTO clientes (id, nome, matricula, cpf, data_nascimento, telefone, email, limite, tipo_limite, dia_vencimento, obs, status, data_cadastro, score_manual, score_gestor, foto, tipo_pagamento, banco, agencia, conta, chave_pix, operacao, score_credito, pagamentos_em_dia, blacklist, motivo_bloqueio, contatos, tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.id, c.nome, c.matricula, c.cpf, c.data_nascimento, c.telefone, c.email,
      c.limite, c.tipo_limite, c.dia_vencimento, c.obs, c.status, c.data_cadastro,
      c.score_manual, c.score_gestor, c.foto, c.tipo_pagamento, c.banco, c.agencia,
      c.conta, c.chave_pix, c.operacao, c.score_credito, c.pagamentos_em_dia,
      c.blacklist, c.motivo_bloqueio, c.contatos, c.tenant_id, c.created_at, c.updated_at
    ]
  );
}

function updateCliente(id, tenantId, c) {
  return run(
    `UPDATE clientes
     SET nome = ?, matricula = ?, cpf = ?, data_nascimento = ?, telefone = ?, email = ?,
         limite = ?, tipo_limite = ?, dia_vencimento = ?, obs = ?, status = ?,
         score_manual = ?, score_gestor = ?, foto = ?, tipo_pagamento = ?, banco = ?,
         agencia = ?, conta = ?, chave_pix = ?, operacao = ?, score_credito = ?,
         pagamentos_em_dia = ?, blacklist = ?, motivo_bloqueio = ?, contatos = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      c.nome, c.matricula, c.cpf, c.data_nascimento, c.telefone, c.email,
      c.limite, c.tipo_limite, c.dia_vencimento, c.obs, c.status,
      c.score_manual, c.score_gestor, c.foto, c.tipo_pagamento, c.banco,
      c.agencia, c.conta, c.chave_pix, c.operacao, c.score_credito,
      c.pagamentos_em_dia, c.blacklist, c.motivo_bloqueio, c.contatos, c.updated_at,
      id, tenantId
    ]
  );
}

function updateBlacklist(id, tenantId, blacklist, motivoBloqueio, now) {
  return run(
    `UPDATE clientes
     SET blacklist = ?, motivo_bloqueio = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [blacklist ? 1 : 0, motivoBloqueio || '', now, id, tenantId]
  );
}

function deleteCliente(id, tenantId) {
  return run('DELETE FROM clientes WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

function checkMatriculaExists(matricula, tenantId, excludeId) {
  let query = 'SELECT id FROM clientes WHERE UPPER(TRIM(matricula)) = ? AND tenant_id = ?';
  const params = [matricula, tenantId];

  if (excludeId) {
    query += ' AND id <> ?';
    params.push(excludeId);
  }
  query += ' LIMIT 1';

  const row = queryOne(query, params);
  return !!row;
}

module.exports = {
  findClienteById,
  listClientes,
  countClientes,
  createCliente,
  updateCliente,
  updateBlacklist,
  deleteCliente,
  checkMatriculaExists,
};
