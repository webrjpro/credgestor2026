const reciboRepository = require('../repositories/recibo.repository');
const { transaction } = require('../database');
const { generateId } = require('../utils/helpers');

const DEFAULT_TENANT = 'default';

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
}

const validateString = (val, max = 500) => String(val || '').trim().slice(0, max);

function mapReciboToFrontend(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    numeroRecibo: row.numero_recibo || '',
    arquivoAprovadoId: row.arquivo_aprovado_id || '',
    emprestimoId: row.emprestimo_id || '',
    clienteId: row.cliente_id || '',
    clienteNome: row.cliente_nome || '',
    clienteCpf: row.cliente_cpf || '',
    clienteTelefone: row.cliente_telefone || '',
    transferencia: row.transferencia || '',
    valor: Number(row.valor) || 0,
    parcelas: Number(row.parcelas) || 1,
    status: row.status || 'pendente',
    operadorNome: row.operador_nome || '',
    operadorEmail: row.operador_email || '',
    dataEntrega: row.data_entrega || '',
    dataEstorno: row.data_estorno || '',
    justificativaEstorno: row.justificativa_estorno || '',
    pdfHash: row.pdf_hash || '',
    observacao: row.observacao || '',
    tenantId: row.tenant_id || 'default'
  };
}

function gerarNumeroRecibo() {
  const ano = new Date().getFullYear();
  const prefix = `REC-${ano}-`;
  const row = reciboRepository.getLastReciboByNumeroPrefix(`${prefix}%`);
  
  let proximo = 1;
  if (row && row.numero_recibo) {
    const m = String(row.numero_recibo).match(/-(\d+)$/);
    if (m) proximo = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(proximo).padStart(6, '0')}`;
}

async function getRecibo(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const row = reciboRepository.findReciboById(id, safeTenant);
  return mapReciboToFrontend(row);
}

async function listRecibosByArquivo(arquivoId, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const rows = reciboRepository.listRecibosByArquivo(arquivoId, safeTenant);
  return rows.map(mapReciboToFrontend);
}

async function listRecibosPendentes(tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const rows = reciboRepository.listRecibosPendentes(safeTenant);
  return rows.map(mapReciboToFrontend);
}

async function criarRecibos(tenantId, { arquivoId, contratos }) {
  const safeTenant = normalizeTenantId(tenantId);
  if (!Array.isArray(contratos) || contratos.length === 0) {
    const err = new Error('Lista de contratos inválida');
    err.statusCode = 400;
    err.code = 'INVALID_CONTRACTS_LIST';
    throw err;
  }

  const criados = [];
  transaction(() => {
    for (const c of contratos) {
      const id = generateId();
      const numero = gerarNumeroRecibo();
      const valor = Number(c.valor) || 0;
      const parcelas = parseInt(c.parcelas, 10) || 1;

      reciboRepository.createRecibo({
        id,
        numero_recibo: numero,
        arquivo_aprovado_id: String(arquivoId || ''),
        emprestimo_id: String(c.empId || c.emprestimo_id || ''),
        cliente_id: String(c.clienteId || c.cliente_id || ''),
        cliente_nome: validateString(c.clienteNome || '', 200),
        cliente_cpf: validateString(c.clienteCpf || '', 20),
        cliente_telefone: validateString(c.clienteTelefone || c.telefone || '', 20),
        transferencia: validateString(c.transferencia || '', 500),
        valor,
        parcelas,
        status: 'pendente',
        tenant_id: safeTenant,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      criados.push({ id, numeroRecibo: numero });
    }
  });

  return criados;
}

async function entregarRecibo(id, tenantId, { operadorNome, operadorEmail, pdfHash, observacao }) {
  const safeTenant = normalizeTenantId(tenantId);
  const row = reciboRepository.findReciboById(id, safeTenant);
  if (!row) {
    const err = new Error('Recibo não encontrado');
    err.statusCode = 404;
    err.code = 'RECIBO_NOT_FOUND';
    throw err;
  }
  if (row.status !== 'pendente') {
    const err = new Error('Recibo não está mais pendente');
    err.statusCode = 409;
    err.code = 'RECIBO_NOT_PENDING';
    throw err;
  }

  const now = new Date().toISOString();
  reciboRepository.updateRecibo(id, safeTenant, {
    ...row,
    status: 'entregue',
    operador_nome: validateString(operadorNome || '', 100),
    operador_email: validateString(operadorEmail || '', 100),
    pdf_hash: validateString(pdfHash || '', 256),
    observacao: validateString(observacao || '', 2000),
    data_entrega: now,
    data_estorno: '',
    justificativa_estorno: '',
    updated_at: now,
  });

  const updated = reciboRepository.findReciboById(id, safeTenant);
  return mapReciboToFrontend(updated);
}

async function estornarRecibo(id, tenantId, { justificativa, operadorNome, operadorEmail }) {
  const safeTenant = normalizeTenantId(tenantId);
  const row = reciboRepository.findReciboById(id, safeTenant);
  if (!row) {
    const err = new Error('Recibo não encontrado');
    err.statusCode = 404;
    err.code = 'RECIBO_NOT_FOUND';
    throw err;
  }
  if (row.status !== 'entregue') {
    const err = new Error('Apenas recibos entregues podem ser estornados');
    err.statusCode = 409;
    err.code = 'RECIBO_NOT_DELIVERED';
    throw err;
  }

  const now = new Date().toISOString();
  const opNome = operadorNome ? validateString(operadorNome, 100) : row.operador_nome;
  const opEmail = operadorEmail ? validateString(operadorEmail, 200) : row.operador_email;

  reciboRepository.updateRecibo(id, safeTenant, {
    ...row,
    status: 'estornado',
    justificativa_estorno: validateString(justificativa || '', 1000),
    operador_nome: opNome,
    operador_email: opEmail,
    data_estorno: now,
    updated_at: now,
  });

  const updated = reciboRepository.findReciboById(id, safeTenant);
  return mapReciboToFrontend(updated);
}

module.exports = {
  getRecibo,
  listRecibosByArquivo,
  listRecibosPendentes,
  criarRecibos,
  entregarRecibo,
  estornarRecibo,
};
