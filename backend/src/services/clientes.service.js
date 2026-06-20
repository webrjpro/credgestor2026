const clienteRepository = require('../repositories/cliente.repository');
const emprestimoRepository = require('../repositories/emprestimo.repository');
const { transaction } = require('../database');
const { generateId, resolve } = require('../utils/helpers');

const DEFAULT_TENANT = 'default';
const SCORE_DEFAULT = 500;
const SCORE_MIN = 0;
const SCORE_MAX = 1000;
const PENALIDADE_ATRASO = 50;
const RECUPERACAO_EM_DIA = 30;
const CICLO_RECUPERACAO = 10;

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SCORE_DEFAULT;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.trunc(n)));
}

function mapToFrontend(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    nome: row.nome || '',
    matricula: row.matricula || '',
    cpf: row.cpf || '',
    dataNascimento: row.data_nascimento || '',
    telefone: row.telefone || '',
    email: row.email || '',
    limite: row.limite ?? 2000,
    tipoLimite: row.tipo_limite || 'total',
    diaVencimento: row.dia_vencimento || '',
    obs: row.obs || '',
    status: row.status || 'ativo',
    dataCadastro: row.data_cadastro || '',
    scoreManual: row.score_manual ?? null,
    scoreGestor: row.score_gestor ?? null,
    foto: row.foto || '',
    tipoPagamento: row.tipo_pagamento || '',
    banco: row.banco || '',
    agencia: row.agencia || '',
    conta: row.conta || '',
    chavePix: row.chave_pix || '',
    operacao: row.operacao || '',
    scoreCredito: row.score_credito ?? SCORE_DEFAULT,
    pagamentosEmDia: row.pagamentos_em_dia ?? 0,
    blacklist: row.blacklist === 1 || row.blacklist === true,
    motivoBloqueio: row.motivo_bloqueio || '',
    contatos: (() => {
      try {
        return typeof row.contatos === 'string' ? JSON.parse(row.contatos || '[]') : [];
      } catch {
        return [];
      }
    })(),
  };
}

function normalizeScoreEvents(input) {
  if (Array.isArray(input)) {
    return input
      .filter(event => event && typeof event === 'object')
      .map(event => ({ pagouComMulta: event.pagouComMulta === true || event.comMulta === true }));
  }
  if (input && typeof input === 'object') {
    return [{ pagouComMulta: input.pagouComMulta === true || input.comMulta === true }];
  }
  return [];
}

function applyScoreEvent(current, event) {
  if (event.pagouComMulta) {
    current.scoreCredito = clampScore(current.scoreCredito - PENALIDADE_ATRASO);
    current.pagamentosEmDia = 0;
    if (current.scoreCredito <= SCORE_MIN) current.blacklist = true;
    return;
  }

  current.pagamentosEmDia += 1;
  if (current.pagamentosEmDia >= CICLO_RECUPERACAO) {
    current.scoreCredito = clampScore(current.scoreCredito + RECUPERACAO_EM_DIA);
    current.pagamentosEmDia = 0;
  }
}

function applyPaymentScore({ tenantId, clienteId, scoreEventos, pagouComMulta, now = new Date().toISOString() }) {
  const normalizedTenant = normalizeTenantId(tenantId);
  const id = String(clienteId || '').trim();
  if (!id) return null;

  const eventos = normalizeScoreEvents(
    Array.isArray(scoreEventos)
      ? scoreEventos
      : (typeof pagouComMulta === 'boolean' ? { pagouComMulta } : null)
  );
  if (eventos.length === 0) {
    const existing = clienteRepository.findClienteById(id, normalizedTenant);
    return mapToFrontend(existing);
  }

  const row = clienteRepository.findClienteById(id, normalizedTenant);
  if (!row) return null;

  const next = {
    scoreCredito: clampScore(row.score_credito ?? SCORE_DEFAULT),
    pagamentosEmDia: Math.max(0, Math.trunc(Number(row.pagamentos_em_dia || 0))),
    blacklist: row.blacklist === 1 || row.blacklist === true,
  };

  for (const event of eventos) applyScoreEvent(next, event);

  clienteRepository.updateCliente(id, normalizedTenant, {
    ...row,
    score_credito: next.scoreCredito,
    pagamentos_em_dia: next.pagamentosEmDia,
    blacklist: next.blacklist ? 1 : 0,
    updated_at: now,
  });

  const updated = clienteRepository.findClienteById(id, normalizedTenant);
  return mapToFrontend(updated);
}

function setBlacklist({ tenantId, clienteId, blocked, motivo = '', minScoreOnUnblock = 100, now = new Date().toISOString() }) {
  const normalizedTenant = normalizeTenantId(tenantId);
  const id = String(clienteId || '').trim();
  if (!id) return null;

  const row = clienteRepository.findClienteById(id, normalizedTenant);
  if (!row) return null;

  const isBlocked = blocked === true;
  const scoreAtual = clampScore(row.score_credito ?? SCORE_DEFAULT);
  const scoreFinal = isBlocked ? scoreAtual : Math.max(scoreAtual, Math.trunc(Number(minScoreOnUnblock) || 100));
  const motivoFinal = isBlocked ? String(motivo || 'manual').slice(0, 100) : '';

  clienteRepository.updateBlacklist(id, normalizedTenant, isBlocked, motivoFinal, now);
  
  // Update score as well
  if (!isBlocked && scoreFinal !== scoreAtual) {
    clienteRepository.updateCliente(id, normalizedTenant, {
      ...row,
      score_credito: scoreFinal,
      blacklist: 0,
      motivo_bloqueio: '',
      updated_at: now,
    });
  }

  const updated = clienteRepository.findClienteById(id, normalizedTenant);
  return mapToFrontend(updated);
}

async function listClientes({ tenantId, page, limit, search, status, orderBy, order }) {
  const safeTenant = normalizeTenantId(tenantId);
  const offset = (page - 1) * limit;

  const allowedColumns = { nome: 'nome', created_at: 'created_at', data_cadastro: 'data_cadastro', limite: 'limite' };
  const col = allowedColumns[orderBy] || 'nome';
  const dir = order === 'desc' ? 'DESC' : 'ASC';

  const total = clienteRepository.countClientes({ tenantId: safeTenant, search, status });
  const rows = clienteRepository.listClientes({ tenantId: safeTenant, search, status, col, dir, limit, offset });

  return {
    data: rows.map(mapToFrontend),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getCliente(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const cliente = clienteRepository.findClienteById(id, safeTenant);
  if (!cliente) return null;

  const emprestimos = emprestimoRepository.listEmprestimos({
    tenantId: safeTenant,
    clienteId: id,
    col: 'data_inicio',
    dir: 'DESC',
    limit: 1000,
    offset: 0,
  });

  return {
    ...mapToFrontend(cliente),
    emprestimos,
  };
}

async function createCliente(tenantId, b) {
  const safeTenant = normalizeTenantId(tenantId);
  const id = b.id || generateId();
  const now = new Date().toISOString();
  const cpf = b.cpf || '';

  if (cpf) {
    // Check duplicate
    const existing = clienteRepository.listClientes({
      tenantId: safeTenant,
      search: cpf,
      limit: 1,
      offset: 0,
      col: 'nome',
      dir: 'ASC',
    });
    const dup = existing.find(c => c.cpf === cpf);
    if (dup) {
      const err = new Error('CPF já cadastrado');
      err.statusCode = 409;
      err.code = 'DUPLICATE_CPF';
      throw err;
    }
  }

  clienteRepository.createCliente({
    id,
    nome: b.nome,
    matricula: (b.matricula || '').toString().trim(),
    cpf,
    data_nascimento: resolve(b, 'dataNascimento', 'data_nascimento', ''),
    telefone: b.telefone || '',
    email: b.email || '',
    limite: b.limite ?? 2000,
    tipo_limite: resolve(b, 'tipoLimite', 'tipo_limite', 'total'),
    dia_vencimento: resolve(b, 'diaVencimento', 'dia_vencimento', ''),
    obs: b.obs || '',
    status: b.status || 'ativo',
    data_cadastro: resolve(b, 'dataCadastro', 'data_cadastro', now.split('T')[0]),
    score_manual: resolve(b, 'scoreManual', 'score_manual', null),
    score_gestor: resolve(b, 'scoreGestor', 'score_gestor', null),
    foto: b.foto || '',
    tipo_pagamento: resolve(b, 'tipoPagamento', 'tipo_pagamento', ''),
    banco: b.banco || '',
    agencia: b.agencia || '',
    conta: b.conta || '',
    chave_pix: resolve(b, 'chavePix', 'chave_pix', ''),
    operacao: b.operacao || '',
    score_credito: resolve(b, 'scoreCredito', 'score_credito', 500),
    pagamentos_em_dia: resolve(b, 'pagamentosEmDia', 'pagamentos_em_dia', 0),
    blacklist: (b.blacklist === true || b.blacklist === 1) ? 1 : 0,
    motivo_bloqueio: resolve(b, 'motivoBloqueio', 'motivo_bloqueio', ''),
    contatos: typeof b.contatos === 'string' ? b.contatos : JSON.stringify(b.contatos || []),
    tenant_id: safeTenant,
    created_at: now,
    updated_at: now,
  });

  const created = clienteRepository.findClienteById(id, safeTenant);
  return mapToFrontend(created);
}

async function batchCreateClientes(tenantId, clientes) {
  const safeTenant = normalizeTenantId(tenantId);
  const now = new Date().toISOString();
  const ids = [];

  transaction(() => {
    for (const b of clientes) {
      const id = b.id || generateId();
      clienteRepository.createCliente({
        id,
        nome: b.nome || '',
        matricula: (b.matricula || '').toString().trim(),
        cpf: b.cpf || '',
        data_nascimento: resolve(b, 'dataNascimento', 'data_nascimento', ''),
        telefone: b.telefone || '',
        email: b.email || '',
        limite: b.limite ?? 2000,
        tipo_limite: resolve(b, 'tipoLimite', 'tipo_limite', 'total'),
        dia_vencimento: resolve(b, 'diaVencimento', 'dia_vencimento', ''),
        obs: b.obs || '',
        status: b.status || 'ativo',
        data_cadastro: resolve(b, 'dataCadastro', 'data_cadastro', now.split('T')[0]),
        score_manual: resolve(b, 'scoreManual', 'score_manual', null),
        score_gestor: resolve(b, 'scoreGestor', 'score_gestor', null),
        foto: b.foto || '',
        tipo_pagamento: resolve(b, 'tipoPagamento', 'tipo_pagamento', ''),
        banco: b.banco || '',
        agencia: b.agencia || '',
        conta: b.conta || '',
        chave_pix: resolve(b, 'chavePix', 'chave_pix', ''),
        operacao: b.operacao || '',
        score_credito: resolve(b, 'scoreCredito', 'score_credito', 500),
        pagamentos_em_dia: resolve(b, 'pagamentosEmDia', 'pagamentos_em_dia', 0),
        blacklist: (b.blacklist === true || b.blacklist === 1) ? 1 : 0,
        motivo_bloqueio: resolve(b, 'motivoBloqueio', 'motivo_bloqueio', ''),
        contatos: typeof b.contatos === 'string' ? b.contatos : JSON.stringify(b.contatos || []),
        tenant_id: safeTenant,
        created_at: now,
        updated_at: now,
      });
      ids.push(id);
    }
  });

  return { success: true, count: ids.length, ids };
}

async function updateCliente(id, tenantId, b) {
  const safeTenant = normalizeTenantId(tenantId);
  const existing = clienteRepository.findClienteById(id, safeTenant);
  if (!existing) {
    const err = new Error('Cliente não encontrado');
    err.statusCode = 404;
    err.code = 'CLIENT_NOT_FOUND';
    throw err;
  }

  if (b.cpf && b.cpf !== existing.cpf) {
    const existingList = clienteRepository.listClientes({
      tenantId: safeTenant,
      search: b.cpf,
      limit: 1,
      offset: 0,
      col: 'nome',
      dir: 'ASC',
    });
    const dup = existingList.find(c => c.cpf === b.cpf && c.id !== id);
    if (dup) {
      const err = new Error('CPF já cadastrado');
      err.statusCode = 409;
      err.code = 'DUPLICATE_CPF';
      throw err;
    }
  }

  const now = new Date().toISOString();
  
  const updatedData = {
    nome: b.nome !== undefined ? b.nome : existing.nome,
    matricula: b.matricula !== undefined ? b.matricula.toString().trim() : existing.matricula,
    cpf: b.cpf !== undefined ? b.cpf : existing.cpf,
    data_nascimento: resolve(b, 'dataNascimento', 'data_nascimento', existing.data_nascimento),
    telefone: b.telefone !== undefined ? b.telefone : existing.telefone,
    email: b.email !== undefined ? b.email : existing.email,
    limite: b.limite !== undefined ? b.limite : existing.limite,
    tipo_limite: resolve(b, 'tipoLimite', 'tipo_limite', existing.tipo_limite),
    dia_vencimento: resolve(b, 'diaVencimento', 'dia_vencimento', existing.dia_vencimento),
    obs: b.obs !== undefined ? b.obs : existing.obs,
    status: b.status !== undefined ? b.status : existing.status,
    score_manual: resolve(b, 'scoreManual', 'score_manual', existing.score_manual),
    score_gestor: resolve(b, 'scoreGestor', 'score_gestor', existing.score_gestor),
    foto: b.foto !== undefined ? b.foto : existing.foto,
    tipo_pagamento: resolve(b, 'tipoPagamento', 'tipo_pagamento', existing.tipo_pagamento),
    banco: b.banco !== undefined ? b.banco : existing.banco,
    agencia: b.agencia !== undefined ? b.agencia : existing.agencia,
    conta: b.conta !== undefined ? b.conta : existing.conta,
    chave_pix: resolve(b, 'chavePix', 'chave_pix', existing.chave_pix),
    operacao: b.operacao !== undefined ? b.operacao : existing.operacao,
    score_credito: resolve(b, 'scoreCredito', 'score_credito', existing.score_credito),
    pagamentos_em_dia: resolve(b, 'pagamentosEmDia', 'pagamentos_em_dia', existing.pagamentos_em_dia),
    blacklist: resolve(b, 'blacklist', 'blacklist', existing.blacklist),
    motivo_bloqueio: resolve(b, 'motivoBloqueio', 'motivo_bloqueio', existing.motivo_bloqueio),
    contatos: b.contatos !== undefined ? (typeof b.contatos === 'string' ? b.contatos : JSON.stringify(b.contatos)) : existing.contatos,
    updated_at: now,
  };

  // Enforce types for boolean/number fields
  if (typeof updatedData.blacklist === 'boolean') {
    updatedData.blacklist = updatedData.blacklist ? 1 : 0;
  }

  clienteRepository.updateCliente(id, safeTenant, updatedData);
  const updated = clienteRepository.findClienteById(id, safeTenant);
  return mapToFrontend(updated);
}

async function deleteCliente(id, tenantId) {
  const safeTenant = normalizeTenantId(tenantId);
  const existing = clienteRepository.findClienteById(id, safeTenant);
  if (!existing) {
    const err = new Error('Cliente não encontrado');
    err.statusCode = 404;
    err.code = 'CLIENT_NOT_FOUND';
    throw err;
  }

  const loans = emprestimoRepository.listEmprestimos({
    tenantId: safeTenant,
    clienteId: id,
    col: 'id',
    dir: 'ASC',
    limit: 1,
    offset: 0,
  });

  if (loans.length > 0) {
    const err = new Error('Não é possível excluir um cliente com empréstimos ativos');
    err.statusCode = 409;
    err.code = 'CLIENT_HAS_LOANS';
    throw err;
  }

  clienteRepository.deleteCliente(id, safeTenant);
  return { success: true };
}

async function checkMatricula(tenantId, matricula, excludeId) {
  const safeTenant = normalizeTenantId(tenantId);
  const normMatricula = typeof matricula === 'string' ? matricula.trim().toUpperCase().slice(0, 64) : '';
  if (!normMatricula) {
    return { success: true, exists: false, normalized: '' };
  }

  const exists = clienteRepository.checkMatriculaExists(normMatricula, safeTenant, excludeId);
  return {
    success: true,
    exists,
    normalized: normMatricula,
  };
}

module.exports = {
  applyPaymentScore,
  mapToFrontend,
  setBlacklist,
  listClientes,
  getCliente,
  createCliente,
  batchCreateClientes,
  updateCliente,
  deleteCliente,
  checkMatricula,
};
