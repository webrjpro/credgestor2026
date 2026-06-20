const { queryOne, queryAll, run, execMulti, transaction, getDb } = require('../database');
const path = require('path');
const fs = require('fs');

const BCRYPT_ROUNDS = 12;

async function getSystemState(tenantId) {
  const clientes = queryAll('SELECT * FROM clientes WHERE tenant_id = ?', [tenantId]);
  const emprestimos = queryAll('SELECT * FROM emprestimos WHERE tenant_id = ?', [tenantId]);
  const transacoes = queryAll('SELECT * FROM transacoes WHERE tenant_id = ?', [tenantId]);
  const caixaRow = queryOne('SELECT saldo FROM caixa WHERE tenant_id = ?', [tenantId]);
  const caixaHistorico = queryAll('SELECT * FROM caixa_historico WHERE tenant_id = ? ORDER BY id ASC', [tenantId]);
  const configRows = queryAll('SELECT chave, valor FROM config WHERE tenant_id = ?', [tenantId]);
  const arquivoAprovados = queryAll('SELECT * FROM arquivo_aprovados WHERE tenant_id = ? ORDER BY id DESC', [tenantId]);

  const config = {};
  for (const row of configRows) {
    config[row.chave] = row.valor;
  }

  const mappedClientes = clientes.map(c => ({
    id: String(c.id),
    nome: c.nome,
    matricula: c.matricula || '',
    cpf: c.cpf || '',
    dataNascimento: c.data_nascimento || '',
    telefone: c.telefone || '',
    email: c.email || '',
    limite: c.limite ?? 2000,
    tipoLimite: c.tipo_limite || 'total',
    diaVencimento: c.dia_vencimento || '',
    obs: c.obs || '',
    status: c.status || 'ativo',
    dataCadastro: c.data_cadastro || '',
    scoreManual: c.score_manual ?? null,
    scoreGestor: c.score_gestor ?? null,
    foto: c.foto || '',
    tipoPagamento: c.tipo_pagamento || '',
    banco: c.banco || '',
    agencia: c.agencia || '',
    conta: c.conta || '',
    chavePix: c.chave_pix || '',
    operacao: c.operacao || '',
    scoreCredito: c.score_credito ?? 500,
    pagamentosEmDia: c.pagamentos_em_dia ?? 0,
    blacklist: c.blacklist === 1 || c.blacklist === true,
    motivoBloqueio: c.motivo_bloqueio || '',
    contatos: (() => { try { return typeof c.contatos === 'string' ? JSON.parse(c.contatos || '[]') : []; } catch { return []; } })()
  }));

  const mappedEmprestimos = emprestimos.map(e => {
    let plano = {};
    try {
      plano = typeof e.plano === 'string' ? JSON.parse(e.plano || '{}') : {};
      if (!plano || typeof plano !== 'object' || Array.isArray(plano)) plano = {};
    } catch (_) { plano = {}; }

    const parcelas = (() => {
      try { return typeof e.historico_pagamentos === 'string' ? JSON.parse(e.historico_pagamentos || '[]') : []; }
      catch { return []; }
    })();

    return {
      id: String(e.id),
      clienteId: e.cliente_id,
      valorOriginal: e.valor,
      taxaJuros: e.taxa,
      valorTotal: plano.valorTotal ?? (e.valor_parcela * e.parcelas),
      tipo: e.tipo,
      dataInicio: e.data_inicio,
      dataVencimento: e.data_vencimento || '',
      multaDiaria: plano.multaDiaria ?? 1,
      multaFixa: plano.multaFixa ?? 0,
      carenciaDias: plano.carenciaDias ?? 5,
      parcelas,
      statusGeral: e.status || 'ativo',
      aprovacao: plano.aprovacao ?? 'aprovado',
      liberadoPor: plano.liberadoPor ?? null,
      gestorResponsavel: plano.gestorResponsavel ?? '',
      obs: e.obs || '',
    };
  });

  const mappedTransacoes = transacoes.map(t => ({
    id: String(t.id),
    tipo: t.tipo,
    descricao: t.descricao || '',
    valor: t.valor,
    data: t.data,
    referenciaId: t.referencia_id || '',
    clienteNome: t.cliente_nome || ''
  }));

  const mappedCaixaHistorico = caixaHistorico.map(ch => ({
    tipo: ch.tipo,
    valor: ch.valor,
    descricao: ch.descricao || '',
    data: ch.data,
    saldoAnterior: ch.saldo_anterior || 0,
    saldoPosterior: ch.saldo_posterior || 0
  }));

  const mappedArquivoAprovados = arquivoAprovados.map(a => ({
    id: String(a.id),
    dataImpressao: a.data_impressao || '',
    horaImpressao: a.hora_impressao || '',
    timestamp: a.timestamp || 0,
    contratos: (() => { try { return typeof a.contratos === 'string' ? JSON.parse(a.contratos || '[]') : []; } catch { return []; } })()
  }));

  return {
    clientes: mappedClientes,
    emprestimos: mappedEmprestimos,
    transacoes: mappedTransacoes,
    caixa: {
      saldo: caixaRow ? caixaRow.saldo : 0,
      historico: mappedCaixaHistorico
    },
    config,
    arquivoAprovados: mappedArquivoAprovados,
    lastSave: new Date().toISOString()
  };
}

async function restoreSystemState(tenantId, state) {
  if (!state || typeof state !== 'object') {
    const err = new Error('Estado inválido');
    err.statusCode = 400;
    err.code = 'INVALID_STATE';
    throw err;
  }

  transaction(() => {
    // 1. Limpar dados existentes do tenant
    run('DELETE FROM recibos_entrega WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM arquivo_aprovados WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM transacoes WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM emprestimos WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM clientes WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM caixa_historico WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM caixa WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM config WHERE tenant_id = ?', [tenantId]);

    // 2. Importar clientes
    if (Array.isArray(state.clientes)) {
      for (const c of state.clientes) {
        run(
          `INSERT INTO clientes (id, nome, matricula, cpf, data_nascimento, telefone, email, limite, tipo_limite, dia_vencimento, obs, status, data_cadastro, score_manual, score_gestor, foto, tipo_pagamento, banco, agencia, conta, chave_pix, operacao, score_credito, pagamentos_em_dia, blacklist, motivo_bloqueio, contatos, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            String(c.id), c.nome || '', (c.matricula || '').toString().trim(), c.cpf || '',
            c.dataNascimento || c.data_nascimento || '', c.telefone || '', c.email || '',
            c.limite ?? 2000, c.tipoLimite || c.tipo_limite || 'total', c.diaVencimento || c.dia_vencimento || '',
            c.obs || '', c.status || 'ativo', c.dataCadastro || c.data_cadastro || '',
            c.scoreManual ?? c.score_manual ?? null, c.scoreGestor ?? c.score_gestor ?? null,
            c.foto || '', c.tipoPagamento || c.tipo_pagamento || '', c.banco || '', c.agencia || '',
            c.conta || '', c.chavePix || c.chave_pix || '', c.operacao || '', c.scoreCredito ?? c.score_credito ?? 500,
            c.pagamentosEmDia ?? c.pagamentos_em_dia ?? 0, (c.blacklist === true || c.blacklist === 1) ? 1 : 0,
            c.motivoBloqueio || c.motivo_bloqueio || '',
            typeof c.contatos === 'string' ? c.contatos : JSON.stringify(c.contatos || []),
            tenantId
          ]
        );
      }
    }

    // 3. Importar emprestimos
    if (Array.isArray(state.emprestimos)) {
      for (const e of state.emprestimos) {
        const valor = Number(e.valorOriginal ?? e.valor ?? 0);
        const parcelasCount = Array.isArray(e.parcelas) ? e.parcelas.length : 1;
        const valorParcela = parcelasCount > 0 ? (Number(e.valorTotal ?? e.valorOriginal ?? 0) / parcelasCount) : valor;
        const planoData = JSON.stringify({
          multaDiaria: Number(e.multaDiaria ?? 1),
          multaFixa: Number(e.multaFixa ?? 0),
          carenciaDias: Number(e.carenciaDias ?? 5),
          valorTotal: Number(e.valorTotal ?? (valor + valor * Number(e.taxaJuros ?? e.taxa ?? 0) / 100)),
          gestorResponsavel: e.gestorResponsavel ?? '',
          liberadoPor: e.liberadoPor ?? null,
          aprovacao: e.aprovacao ?? 'aprovado',
        });

        run(
          `INSERT INTO emprestimos (id, cliente_id, valor, tipo, taxa, parcelas, parcelas_pagas, valor_parcela, data_inicio, data_vencimento, status, historico_pagamentos, obs, plano, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            String(e.id), String(e.clienteId || e.cliente_id || ''), valor,
            e.tipo || 'parcelado', Number(e.taxaJuros ?? e.taxa ?? 0), parcelasCount,
            Array.isArray(e.parcelas) ? e.parcelas.filter(p => p.status === 'pago').length : 0,
            valorParcela, e.dataInicio || e.data_inicio || '', e.dataVencimento || e.data_vencimento || null,
            e.statusGeral || e.status || 'ativo',
            typeof e.parcelas === 'string' ? e.parcelas : JSON.stringify(e.parcelas || []),
            e.obs || '', planoData, tenantId
          ]
        );
      }
    }

    // 4. Importar transacoes
    if (Array.isArray(state.transacoes)) {
      for (const t of state.transacoes) {
        run(
          `INSERT INTO transacoes (id, tipo, descricao, valor, data, referencia_id, cliente_nome, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            String(t.id), t.tipo || 'entrada', t.descricao || '', Number(t.valor || 0),
            t.data || '', String(t.referenciaId || t.referencia_id || ''), t.clienteNome || t.cliente_nome || '',
            tenantId
          ]
        );
      }
    }

    // 5. Caixa saldo
    const saldoCaixa = Number(state.caixa?.saldo || 0);
    run(
      `INSERT INTO caixa (tenant_id, saldo, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(tenant_id) DO UPDATE SET saldo = excluded.saldo, updated_at = excluded.updated_at`,
      [tenantId, saldoCaixa]
    );

    // 6. Caixa histórico
    if (Array.isArray(state.caixa?.historico)) {
      for (const ch of state.caixa.historico) {
        run(
          `INSERT INTO caixa_historico (tipo, valor, descricao, data, saldo_anterior, saldo_posterior, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            ch.tipo || 'entrada', Number(ch.valor || 0), ch.descricao || '',
            ch.data || '', Number(ch.saldoAnterior || ch.saldo_anterior || 0),
            Number(ch.saldoPosterior || ch.saldo_posterior || 0), tenantId
          ]
        );
      }
    }

    // 7. Config
    if (state.config && typeof state.config === 'object') {
      for (const [chave, valor] of Object.entries(state.config)) {
        run(
          `INSERT INTO config (chave, valor, tenant_id, updated_at) VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(chave, tenant_id) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at`,
          [chave, String(valor ?? ''), tenantId]
        );
      }
    }

    // 8. Arquivo Aprovados
    if (Array.isArray(state.arquivoAprovados)) {
      for (const a of state.arquivoAprovados) {
        run(
          `INSERT INTO arquivo_aprovados (id, data_impressao, hora_impressao, timestamp, contratos, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            String(a.id), a.dataImpressao || a.data_impressao || '',
            a.horaImpressao || a.hora_impressao || '', Number(a.timestamp || 0),
            typeof a.contratos === 'string' ? a.contratos : JSON.stringify(a.contratos || []),
            tenantId
          ]
        );
      }
    }
  });

  return { success: true };
}

async function resetSystem(tenantId) {
  transaction(() => {
    run('DELETE FROM recibos_entrega WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM arquivo_aprovados WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM transacoes WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM emprestimos WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM clientes WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM caixa_historico WHERE tenant_id = ?', [tenantId]);
    run('UPDATE caixa SET saldo = 0, updated_at = datetime(\'now\') WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM config WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM transacoes_archive');
    run('DELETE FROM audit_log WHERE tenant_id = ?', [tenantId]);
    run('DELETE FROM audit_log_archive');
    
    // Seed padrão
    run("INSERT OR IGNORE INTO config (chave, valor, tenant_id) VALUES ('empresaNome', '', ?)", [tenantId]);
    run("INSERT OR IGNORE INTO config (chave, valor, tenant_id) VALUES ('empresaTelefone', '', ?)", [tenantId]);
  });
  return { success: true };
}

async function runRetentionPolicy(tenantId, { transacoesDias, auditDays }) {
  const tDays = Math.min(3650, Math.max(30, parseInt(transacoesDias || 365, 10)));
  const aDays = Math.min(3650, Math.max(30, parseInt(auditDays || 365, 10)));

  let transacoesDeletadas = 0;
  let logsDeletados = 0;

  transaction(() => {
    const limiteTransacoes = new Date(Date.now() - tDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    run(
      `INSERT OR IGNORE INTO transacoes_archive (id, tipo, descricao, valor, data, referencia_id, cliente_nome, created_at)
       SELECT id, tipo, descricao, valor, data, referencia_id, cliente_nome, created_at
       FROM transacoes
       WHERE data < ? AND tenant_id = ?`,
      [limiteTransacoes, tenantId]
    );

    const rTx = run('DELETE FROM transacoes WHERE data < ? AND tenant_id = ?', [limiteTransacoes, tenantId]);
    transacoesDeletadas = rTx.changes;

    const limiteAudit = new Date(Date.now() - aDays * 24 * 60 * 60 * 1000).toISOString();
    
    run(
      `INSERT OR IGNORE INTO audit_log_archive (id, action, details, timestamp)
       SELECT id, action, details, timestamp
       FROM audit_log
       WHERE timestamp < ? AND tenant_id = ?`,
      [limiteAudit, tenantId]
    );

    const rAudit = run('DELETE FROM audit_log WHERE timestamp < ? AND tenant_id = ?', [limiteAudit, tenantId]);
    logsDeletados = rAudit.changes;
  });

  return { success: true, transacoesDeletadas, logsDeletados };
}

async function getHealth() {
  const check = queryAll('PRAGMA integrity_check(10)');
  const ok = Array.isArray(check) && check.length === 1 && String(Object.values(check[0])[0]).toLowerCase() === 'ok';

  return {
    ok,
    checks: {
      sqlite: {
        success: true,
        ok,
        messages: check.map(row => String(Object.values(row)[0]))
      }
    },
    timestamp: new Date().toISOString()
  };
}

async function getCredentials() {
  const creds = queryOne('SELECT * FROM auth WHERE id = 1');
  return creds || null;
}

async function resetCredentials() {
  run('DELETE FROM auth WHERE id = 1');
  return { success: true };
}

async function getDbStats(tenantId) {
  const clientes = queryOne('SELECT COUNT(*) as c FROM clientes WHERE tenant_id = ?', [tenantId])?.c || 0;
  const emprestimos = queryOne('SELECT COUNT(*) as c FROM emprestimos WHERE tenant_id = ?', [tenantId])?.c || 0;
  const transacoes = queryOne('SELECT COUNT(*) as c FROM transacoes WHERE tenant_id = ?', [tenantId])?.c || 0;
  const transacoesArchivadas = queryOne('SELECT COUNT(*) as c FROM transacoes_archive')?.c || 0;
  const auditLogs = queryOne('SELECT COUNT(*) as c FROM audit_log WHERE tenant_id = ?', [tenantId])?.c || 0;
  const auditLogsArquivados = queryOne('SELECT COUNT(*) as c FROM audit_log_archive')?.c || 0;
  const emprestimosAtivos = queryOne("SELECT COUNT(*) as c FROM emprestimos WHERE status = 'ativo' AND tenant_id = ?", [tenantId])?.c || 0;

  return {
    clientes,
    emprestimos,
    transacoes,
    transacoesArchivadas,
    auditLogs,
    auditLogsArquivados,
    emprestimosAtivos
  };
}

async function getAuditLogs(tenantId, { limit, offset, action, search, from, to }) {
  let where = 'WHERE l.tenant_id = ?';
  const params = [tenantId];

  if (action) {
    where += ' AND l.action LIKE ?';
    params.push(`%${action}%`);
  }
  if (search) {
    where += ' AND (l.action LIKE ? OR l.details LIKE ? OR l.ip LIKE ? OR a.nome LIKE ? OR a.email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  if (from) {
    where += ' AND l.timestamp >= ?';
    params.push(from);
  }
  if (to) {
    where += ' AND l.timestamp <= ?';
    params.push(to);
  }

  const totalRow = queryOne(
    `SELECT COUNT(*) as total
     FROM audit_log l
     LEFT JOIN auth a ON a.id = l.user_id
     ${where}`,
    params
  );
  const total = totalRow ? totalRow.total : 0;

  const rows = queryAll(
    `SELECT l.id, l.user_id, l.action, l.details, l.ip, l.tenant_id, l.timestamp,
            COALESCE(NULLIF(a.nome, ''), a.email, '') as user_name,
            COALESCE(a.email, '') as user_email
     FROM audit_log l
     LEFT JOIN auth a ON a.id = l.user_id
     ${where}
     ORDER BY l.timestamp DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const logs = rows.map((row) => {
    let details = row.details || {};
    try {
      details = typeof details === 'string' ? JSON.parse(details || '{}') : details;
    } catch (_) {
      details = { raw: row.details || '' };
    }
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name || 'Sistema',
      userEmail: row.user_email || '',
      action: row.action,
      details,
      ip: row.ip || '',
      tenantId: row.tenant_id || tenantId,
      timestamp: row.timestamp
    };
  });

  return { logs, pagination: { total, limit, offset, hasMore: offset + logs.length < total } };
}

async function sqliteBackup(tenantId, { targetPathRaw, ip, userId }) {
  if (!targetPathRaw || !targetPathRaw.toLowerCase().endsWith('.db')) {
    const err = new Error('targetPath .db obrigatório');
    err.statusCode = 400;
    err.code = 'INVALID_BACKUP_PATH';
    throw err;
  }

  const targetPath = path.resolve(targetPathRaw);
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });

  const database = getDb();
  if (!database || typeof database.backup !== 'function') {
    const err = new Error('Backup SQLite indisponível neste runtime');
    err.statusCode = 500;
    err.code = 'BACKUP_UNAVAILABLE';
    throw err;
  }

  await database.backup(targetPath);
  const stat = fs.statSync(targetPath);
  
  return { success: true, path: targetPath, size: stat.size, timestamp: new Date().toISOString() };
}

module.exports = {
  getSystemState,
  restoreSystemState,
  resetSystem,
  runRetentionPolicy,
  getHealth,
  getCredentials,
  resetCredentials,
  getDbStats,
  getAuditLogs,
  sqliteBackup,
};
