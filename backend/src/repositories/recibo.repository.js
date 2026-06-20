const { queryOne, queryAll, run } = require('../database');

function findReciboById(id, tenantId) {
  return queryOne('SELECT * FROM recibos_entrega WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

function findReciboByNumero(numero, tenantId) {
  return queryOne('SELECT * FROM recibos_entrega WHERE numero_recibo = ? AND tenant_id = ?', [numero, tenantId]);
}

function listRecibosByArquivo(arquivoId, tenantId) {
  return queryAll(
    'SELECT * FROM recibos_entrega WHERE arquivo_aprovado_id = ? AND tenant_id = ? ORDER BY id ASC',
    [arquivoId, tenantId]
  );
}

function listRecibosPendentes(tenantId) {
  return queryAll(
    "SELECT * FROM recibos_entrega WHERE status = 'pendente' AND tenant_id = ? ORDER BY created_at DESC",
    [tenantId]
  );
}

function createRecibo(r) {
  return run(
    `INSERT INTO recibos_entrega
      (id, numero_recibo, arquivo_aprovado_id, emprestimo_id, cliente_id,
       cliente_nome, cliente_cpf, cliente_telefone, transferencia, valor, parcelas, status,
       tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.id, r.numero_recibo, r.arquivo_aprovado_id, r.emprestimo_id, r.cliente_id,
      r.cliente_nome, r.cliente_cpf, r.cliente_telefone, r.transferencia, r.valor, r.parcelas, r.status,
      r.tenant_id, r.created_at, r.updated_at
    ]
  );
}

function updateRecibo(id, tenantId, r) {
  return run(
    `UPDATE recibos_entrega
     SET status = ?, operador_nome = ?, operador_email = ?, data_entrega = ?, data_estorno = ?,
         justificativa_estorno = ?, pdf_hash = ?, observacao = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      r.status, r.operador_nome, r.operador_email, r.data_entrega, r.data_estorno,
      r.justificativa_estorno, r.pdf_hash, r.observacao, r.updated_at,
      id, tenantId
    ]
  );
}

function getLastReciboByNumeroPrefix(prefix) {
  return queryOne(
    "SELECT numero_recibo FROM recibos_entrega WHERE numero_recibo LIKE ? ORDER BY id DESC LIMIT 1",
    [prefix]
  );
}

function listArquivoAprovados(tenantId) {
  return queryAll('SELECT * FROM arquivo_aprovados WHERE tenant_id = ? ORDER BY id DESC', [tenantId]);
}

function createArquivoAprovado(a) {
  return run(
    `INSERT INTO arquivo_aprovados (id, data_impressao, hora_impressao, timestamp, contratos, tenant_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.data_impressao, a.hora_impressao, a.timestamp, a.contratos, a.tenant_id, a.created_at]
  );
}

module.exports = {
  findReciboById,
  findReciboByNumero,
  listRecibosByArquivo,
  listRecibosPendentes,
  createRecibo,
  updateRecibo,
  getLastReciboByNumeroPrefix,
  listArquivoAprovados,
  createArquivoAprovado,
};
