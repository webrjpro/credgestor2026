/**
 * Database layer — better-sqlite3
 *
 * Schema SQLite local compartilhada pela API Express.
 * Usa tenant_id nas tabelas operacionais para isolamento local por empresa.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/** @type {import('better-sqlite3').Database} */
let db;
let dbFilePath = '';
let autoRepairInProgress = false;
let lastAutoRepairAt = 0;
const AUTO_REPAIR_COOLDOWN_MS = 5000;
const CORRUPTION_ERROR_RE = /(database disk image is malformed|sqlite_corrupt|malformed|corrupt)/i;

function configureDatabasePragmas(database) {
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  database.pragma('synchronous = NORMAL');
  database.pragma('foreign_keys = ON');
  database.pragma('cache_size = -64000');
  database.pragma('temp_store = MEMORY');
}

function quarantineWalSidecars(basePath, reason) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const suffix of ['-wal', '-shm']) {
    const file = `${basePath}${suffix}`;
    if (!fs.existsSync(file)) continue;
    const target = `${file}.corrupt-${stamp}`;
    try {
      fs.renameSync(file, target);
      console.warn(`[DB] Sidecar SQLite em quarentena (${reason}): ${path.basename(file)} -> ${path.basename(target)}`);
    } catch (error) {
      console.warn(`[DB] Falha ao colocar sidecar em quarentena (${path.basename(file)}):`, error.message);
    }
  }
}

function backupMainDbBeforeOpenRepair(basePath, reason) {
  if (!fs.existsSync(basePath)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = `${basePath}.pre-open-repair-${stamp}.bak`;
  try {
    fs.copyFileSync(basePath, target);
    console.warn(`[DB] Backup preventivo antes do reparo (${reason}): ${path.basename(target)}`);
  } catch (error) {
    console.warn('[DB] Falha ao criar backup preventivo antes do reparo:', error.message);
  }
}

// ── Schema ──
// Schema principal do banco local.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS auth (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT DEFAULT '',
    hash_version TEXT DEFAULT 'bcrypt',
    role TEXT NOT NULL DEFAULT 'gestor',
    tenant_id TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    matricula TEXT DEFAULT '',
    cpf TEXT DEFAULT '',
    data_nascimento TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    limite REAL DEFAULT 2000,
    tipo_limite TEXT DEFAULT 'total',
    dia_vencimento TEXT DEFAULT '',
    obs TEXT DEFAULT '',
    status TEXT DEFAULT 'ativo',
    data_cadastro TEXT NOT NULL DEFAULT (date('now')),
    score_manual INTEGER DEFAULT NULL,
    score_gestor INTEGER DEFAULT NULL,
    foto TEXT DEFAULT '',
    tipo_pagamento TEXT DEFAULT '',
    banco TEXT DEFAULT '',
    agencia TEXT DEFAULT '',
    conta TEXT DEFAULT '',
    chave_pix TEXT DEFAULT '',
    operacao TEXT DEFAULT '',
    score_credito INTEGER DEFAULT 500,
    pagamentos_em_dia INTEGER DEFAULT 0,
    blacklist INTEGER DEFAULT 0,
    motivo_bloqueio TEXT DEFAULT '',
    contatos TEXT DEFAULT '[]',
    tenant_id TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emprestimos (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL,
    valor REAL NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'parcelado',
    taxa REAL DEFAULT 0,
    parcelas INTEGER DEFAULT 1,
    parcelas_pagas INTEGER DEFAULT 0,
    valor_parcela REAL DEFAULT 0,
    data_inicio TEXT NOT NULL,
    data_vencimento TEXT,
    status TEXT DEFAULT 'ativo',
    historico_pagamentos TEXT DEFAULT '[]',
    obs TEXT DEFAULT '',
    plano TEXT DEFAULT '',
    tenant_id TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS transacoes (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    referencia_id TEXT DEFAULT '',
    cliente_nome TEXT DEFAULT '',
    tenant_id TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS caixa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saldo REAL NOT NULL DEFAULT 0,
    tenant_id TEXT DEFAULT 'default' UNIQUE,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS caixa_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    valor REAL NOT NULL,
    descricao TEXT DEFAULT '',
    data TEXT NOT NULL DEFAULT (datetime('now')),
    saldo_anterior REAL DEFAULT 0,
    saldo_posterior REAL DEFAULT 0,
    tenant_id TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config (
    chave TEXT NOT NULL,

    valor TEXT NOT NULL DEFAULT '',
    tenant_id TEXT DEFAULT 'default',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (chave, tenant_id)
  );

  CREATE TABLE IF NOT EXISTS recibos_entrega (
    id                    TEXT PRIMARY KEY,
    numero_recibo         TEXT UNIQUE NOT NULL,
    arquivo_aprovado_id   TEXT NOT NULL DEFAULT '',
    emprestimo_id         TEXT NOT NULL DEFAULT '',
    cliente_id            TEXT NOT NULL DEFAULT '',
    cliente_nome          TEXT NOT NULL DEFAULT '',
    cliente_cpf           TEXT NOT NULL DEFAULT '',
    cliente_telefone      TEXT NOT NULL DEFAULT '',
    transferencia         TEXT NOT NULL DEFAULT '',
    valor                 REAL NOT NULL DEFAULT 0,
    parcelas              INTEGER NOT NULL DEFAULT 1,
    status                TEXT NOT NULL DEFAULT 'pendente',
    operador_nome         TEXT NOT NULL DEFAULT '',
    operador_email        TEXT NOT NULL DEFAULT '',
    data_entrega          TEXT NOT NULL DEFAULT '',
    data_estorno          TEXT NOT NULL DEFAULT '',
    justificativa_estorno TEXT NOT NULL DEFAULT '',
    pdf_hash              TEXT NOT NULL DEFAULT '',
    observacao            TEXT NOT NULL DEFAULT '',
    tenant_id             TEXT DEFAULT 'default',
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS arquivo_aprovados (
    id TEXT PRIMARY KEY,
    data_impressao TEXT NOT NULL,
    hora_impressao TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    contratos TEXT NOT NULL DEFAULT '[]',
    tenant_id TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    ip TEXT DEFAULT '',
    tenant_id TEXT DEFAULT 'default',
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transacoes_archive (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    referencia_id TEXT DEFAULT '',
    cliente_nome TEXT DEFAULT '',
    created_at TEXT,
    archived_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log_archive (
    id INTEGER PRIMARY KEY,
    action TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    timestamp TEXT NOT NULL,
    archived_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES auth(id) ON DELETE CASCADE
  );

  -- Blacklist de access tokens revogados via logout.
  -- Usa o JTI do JWT como chave para evitar guardar o token completo.
  CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti TEXT PRIMARY KEY,
    user_id INTEGER,
    revoked_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plano TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'ativo',
    owner_id INTEGER,
    config TEXT DEFAULT '{}',
    max_users INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    FOREIGN KEY (owner_id) REFERENCES auth(id)
  );

  CREATE TABLE IF NOT EXISTS tenant_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'gestor',
    invited_by INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (invited_by) REFERENCES auth(id)
  );
`;

const INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_clientes_matricula ON clientes(matricula COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);
  CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes(status);
  CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON clientes(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_emprestimos_cliente ON emprestimos(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos(status);
  CREATE INDEX IF NOT EXISTS idx_emprestimos_vencimento ON emprestimos(data_vencimento);
  CREATE INDEX IF NOT EXISTS idx_emprestimos_tenant ON emprestimos(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes(data);
  CREATE INDEX IF NOT EXISTS idx_transacoes_referencia ON transacoes(referencia_id);
  CREATE INDEX IF NOT EXISTS idx_transacoes_tenant ON transacoes(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_recibos_arquivo ON recibos_entrega(arquivo_aprovado_id);
  CREATE INDEX IF NOT EXISTS idx_recibos_status ON recibos_entrega(status);
  CREATE INDEX IF NOT EXISTS idx_recibos_emprestimo ON recibos_entrega(emprestimo_id);
  CREATE INDEX IF NOT EXISTS idx_recibos_numero ON recibos_entrega(numero_recibo);
  CREATE INDEX IF NOT EXISTS idx_recibos_tenant ON recibos_entrega(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_caixa_hist_data ON caixa_historico(data);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
  CREATE INDEX IF NOT EXISTS idx_auth_email ON auth(email);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
  CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);
  CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites(email);
  CREATE INDEX IF NOT EXISTS idx_tenant_invites_token ON tenant_invites(token);
  CREATE INDEX IF NOT EXISTS idx_arquivo_tenant ON arquivo_aprovados(tenant_id);
`;

const SEED = `
  INSERT OR IGNORE INTO tenants (id, nome, slug, plano, status) VALUES ('default', 'Default', 'default', 'enterprise', 'ativo');
  INSERT OR IGNORE INTO caixa (tenant_id, saldo) VALUES ('default', 0);
  INSERT OR IGNORE INTO config (chave, valor, tenant_id) VALUES ('empresaNome', '', 'default');
  INSERT OR IGNORE INTO config (chave, valor, tenant_id) VALUES ('empresaTelefone', '', 'default');
`;

/**
 * Inicializa o banco de dados SQLite.
 * @param {string} dbPath Caminho para o arquivo .db
 */
function initDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  dbFilePath = dbPath;

  try {
    db = new Database(dbPath);
    configureDatabasePragmas(db);
  } catch (err) {
    if (!isCorruptionError(err)) throw err;
    try {
      if (db) db.close();
    } catch (closeErr) {
      console.warn('[DB] Falha ao fechar conexão corrompida antes da quarentena:', closeErr.message);
    }
    backupMainDbBeforeOpenRepair(dbPath, err.message || 'corrupcao na abertura');
    quarantineWalSidecars(dbPath, err.message || 'corrupcao na abertura');
    db = new Database(dbPath);
    configureDatabasePragmas(db);
  }

  db.exec(SCHEMA);

  // ── Migrations: evolução idempotente de schema ──
  migrateIfNeeded(db);

  // Seed executa APÓS migrations para garantir que todas as colunas existem
  // (ex.: tabela caixa/config sem coluna tenant_id).
  db.exec(SEED);

  // ── Indexes: criados APÓS migrations para garantir que colunas existem ──
  db.exec(INDEXES);

  console.log(`[DB] SQLite inicializado: ${dbPath}`);
}

/**
 * Garante colunas e índices esperados pelo backend atual.
 * Usa ALTER TABLE ADD COLUMN (idempotente via try/catch).
 */
function migrateIfNeeded(database) {
  function execSafe(sql) {
    try { database.exec(sql); }
    catch { /* noop */ }
  }

  function addCol(table, col, type) {
    try { database.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); }
    catch { /* coluna já existe */ }
  }

  // Clientes — colunas core
  addCol('clientes', 'cpf', "TEXT DEFAULT ''");
  addCol('clientes', 'matricula', "TEXT DEFAULT ''");
  addCol('clientes', 'telefone', "TEXT DEFAULT ''");
  addCol('clientes', 'email', "TEXT DEFAULT ''");
  addCol('clientes', 'status', "TEXT DEFAULT 'ativo'");
  addCol('clientes', 'created_at', "TEXT DEFAULT (datetime('now'))");
  addCol('clientes', 'updated_at', "TEXT DEFAULT (datetime('now'))");

  // Clientes — colunas novas
  addCol('clientes', 'data_nascimento', "TEXT DEFAULT ''");
  addCol('clientes', 'limite', "REAL DEFAULT 2000");
  addCol('clientes', 'tipo_limite', "TEXT DEFAULT 'total'");
  addCol('clientes', 'dia_vencimento', "TEXT DEFAULT ''");
  addCol('clientes', 'obs', "TEXT DEFAULT ''");
  addCol('clientes', 'data_cadastro', "TEXT NOT NULL DEFAULT (date('now'))");
  addCol('clientes', 'score_manual', "INTEGER DEFAULT NULL");
  addCol('clientes', 'score_gestor', "INTEGER DEFAULT NULL");
  addCol('clientes', 'foto', "TEXT DEFAULT ''");
  addCol('clientes', 'tipo_pagamento', "TEXT DEFAULT ''");
  addCol('clientes', 'banco', "TEXT DEFAULT ''");
  addCol('clientes', 'agencia', "TEXT DEFAULT ''");
  addCol('clientes', 'conta', "TEXT DEFAULT ''");
  addCol('clientes', 'chave_pix', "TEXT DEFAULT ''");
  addCol('clientes', 'operacao', "TEXT DEFAULT ''");
  addCol('clientes', 'score_credito', "INTEGER DEFAULT 500");
  addCol('clientes', 'pagamentos_em_dia', "INTEGER DEFAULT 0");
  addCol('clientes', 'blacklist', "INTEGER DEFAULT 0");
  addCol('clientes', 'motivo_bloqueio', "TEXT DEFAULT ''");
  addCol('clientes', 'contatos', "TEXT DEFAULT '[]'");

  // Empréstimos — colunas novas
  addCol('emprestimos', 'tipo', "TEXT NOT NULL DEFAULT 'parcelado'");
  addCol('emprestimos', 'taxa', "REAL DEFAULT 0");
  addCol('emprestimos', 'valor_parcela', "REAL DEFAULT 0");
  addCol('emprestimos', 'historico_pagamentos', "TEXT DEFAULT '[]'");
  addCol('emprestimos', 'obs', "TEXT DEFAULT ''");
  addCol('emprestimos', 'plano', "TEXT DEFAULT ''");

  // Transações — colunas novas
  addCol('transacoes', 'descricao', "TEXT DEFAULT ''");
  addCol('transacoes', 'referencia_id', "TEXT DEFAULT ''");
  addCol('transacoes', 'cliente_nome', "TEXT DEFAULT ''");

  // Caixa historico
  addCol('caixa_historico', 'saldo_anterior', "REAL DEFAULT 0");
  addCol('caixa_historico', 'saldo_posterior', "REAL DEFAULT 0");

  // Recibos entrega
  addCol('recibos_entrega', 'tenant_id', "TEXT DEFAULT 'default'");

  // Multi-tenant local
  addCol('auth', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('clientes', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('emprestimos', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('transacoes', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('caixa', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('caixa_historico', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('config', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('arquivo_aprovados', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('recibos_entrega', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('audit_log', 'tenant_id', "TEXT DEFAULT 'default'");
  addCol('audit_log', 'user_id', "INTEGER");
  addCol('audit_log', 'ip', "TEXT DEFAULT ''");

  // Campos de timestamp usados pelo backend em UPSERT/query.
  addCol('caixa', 'updated_at', "TEXT DEFAULT ''");
  addCol('config', 'updated_at', "TEXT DEFAULT ''");
  addCol('caixa_historico', 'created_at', "TEXT DEFAULT ''");
  addCol('arquivo_aprovados', 'created_at', "TEXT DEFAULT ''");

  // Normaliza tenant_id.
  execSafe("UPDATE auth SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE clientes SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE emprestimos SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE transacoes SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE caixa SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE caixa_historico SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE config SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE arquivo_aprovados SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE recibos_entrega SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");
  execSafe("UPDATE audit_log SET tenant_id = 'default' WHERE tenant_id IS NULL OR TRIM(tenant_id) = ''");

  // Garante colunas de timestamp preenchidas.
  execSafe("UPDATE caixa SET updated_at = datetime('now') WHERE updated_at IS NULL OR TRIM(updated_at) = ''");
  execSafe("UPDATE config SET updated_at = datetime('now') WHERE updated_at IS NULL OR TRIM(updated_at) = ''");
  execSafe("UPDATE caixa_historico SET created_at = COALESCE(created_at, data, datetime('now')) WHERE created_at IS NULL OR TRIM(created_at) = ''");
  execSafe("UPDATE arquivo_aprovados SET created_at = datetime('now') WHERE created_at IS NULL OR TRIM(created_at) = ''");

  repairDuplicatedCaixaMovements(database);

  // Índices para suportar ON CONFLICT(...).
  // Caixa: mantém uma linha por tenant (default no modo single-tenant).
  execSafe(`
    DELETE FROM caixa
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM caixa
      GROUP BY tenant_id
    )
  `);
  execSafe('CREATE UNIQUE INDEX IF NOT EXISTS idx_caixa_tenant_unique ON caixa(tenant_id)');

  // Config: habilita UPSERT por (chave, tenant_id).
  execSafe('CREATE UNIQUE INDEX IF NOT EXISTS idx_config_chave_tenant_unique ON config(chave, tenant_id)');

  console.log('[DB] Migrations aplicadas');
}

function repairDuplicatedCaixaMovements(database) {
  const approxEqual = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.005;
  try {
    const candidateIds = database.prepare(`
      SELECT id
      FROM caixa_historico
      WHERE descricao = 'Ajuste manual de saldo'
      ORDER BY id ASC
    `).all().map(row => row.id);

    if (candidateIds.length === 0) return;

    const getById = database.prepare('SELECT * FROM caixa_historico WHERE id = ?');
    const getNext = database.prepare(`
      SELECT *
      FROM caixa_historico
      WHERE tenant_id = ? AND id > ?
      ORDER BY id ASC
      LIMIT 1
    `);
    const deleteById = database.prepare('DELETE FROM caixa_historico WHERE id = ?');
    const shiftFollowing = database.prepare(`
      UPDATE caixa_historico
      SET saldo_anterior = saldo_anterior - ?,
          saldo_posterior = saldo_posterior - ?
      WHERE tenant_id = ? AND id > ?
    `);
    const shiftCaixa = database.prepare(`
      UPDATE caixa
      SET saldo = saldo - ?, updated_at = datetime('now')
      WHERE tenant_id = ?
    `);

    let repaired = 0;
    const runRepair = database.transaction(() => {
      for (const id of candidateIds) {
        const ajuste = getById.get(id);
        if (!ajuste) continue;
        const next = getNext.get(ajuste.tenant_id, ajuste.id);
        if (!next) continue;
        if (next.descricao === 'Ajuste manual de saldo') continue;
        if (ajuste.tipo !== next.tipo) continue;
        if (!approxEqual(ajuste.valor, next.valor)) continue;
        if (!approxEqual(ajuste.saldo_posterior, next.saldo_anterior)) continue;

        const delta = ajuste.tipo === 'saida' ? -Number(ajuste.valor || 0) : Number(ajuste.valor || 0);
        if (!Number.isFinite(delta) || delta === 0) continue;

        deleteById.run(ajuste.id);
        shiftFollowing.run(delta, delta, ajuste.tenant_id, ajuste.id);
        shiftCaixa.run(delta, ajuste.tenant_id);
        repaired++;
      }
    });

    runRepair();
    if (repaired > 0) {
      console.log(`[DB] Reparados ${repaired} movimentos duplicados de caixa.`);
    }
  } catch (error) {
    console.warn('[DB] Falha ao reparar movimentos de caixa duplicados:', error.message);
  }
}

// ── Query Helpers ──

function isCorruptionError(err) {
  if (!err) return false;
  const message = String(err.message || err).toLowerCase();
  const code = String(err.code || '').toLowerCase();
  return CORRUPTION_ERROR_RE.test(message) || code === 'sqlite_corrupt';
}

function attemptAutoRepair(reasonErr) {
  if (!db || autoRepairInProgress) return false;

  const now = Date.now();
  if (now - lastAutoRepairAt < AUTO_REPAIR_COOLDOWN_MS) return false;
  lastAutoRepairAt = now;
  autoRepairInProgress = true;

  const reason = String(reasonErr?.message || reasonErr || 'erro desconhecido');
  console.warn(`[DB] Corrupção detectada (${reason}). Tentando autorrecuperação em ${dbFilePath || 'db atual'}...`);

  try {
    // Reconstrói índices e força checkpoint para reduzir chance de erro em WAL.
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (checkpointErr) { console.warn('[DB] Checkpoint WAL falhou durante autorrecuperacao:', checkpointErr.message); }
    try { db.exec('REINDEX'); } catch (reindexErr) { console.warn('[DB] REINDEX falhou durante autorrecuperacao:', reindexErr.message); }
    try { db.pragma('optimize'); } catch (optimizeErr) { console.warn('[DB] PRAGMA optimize falhou durante autorrecuperacao:', optimizeErr.message); }

    const quick = db.pragma('quick_check');
    const failed = Array.isArray(quick) && quick.some((row) => {
      const values = Object.values(row || {});
      return String(values[0] || '').toLowerCase() !== 'ok';
    });
    if (failed) {
      console.error('[DB] quick_check após autorrecuperação retornou inconsistências:', quick);
      return false;
    }

    console.warn('[DB] Autorrecuperação aplicada com sucesso.');
    return true;
  } catch (repairErr) {
    console.error('[DB] Autorrecuperação falhou:', repairErr.message);
    return false;
  } finally {
    autoRepairInProgress = false;
  }
}

function execWithAutoRepair(executor) {
  try {
    return executor();
  } catch (err) {
    if (!isCorruptionError(err)) throw err;
    if (!attemptAutoRepair(err)) throw err;
    return executor();
  }
}

/** SELECT * single row */
function queryOne(sql, params = []) {
  return execWithAutoRepair(() => db.prepare(sql).get(...params) || null);
}

/** SELECT * multiple rows */
function queryAll(sql, params = []) {
  return execWithAutoRepair(() => db.prepare(sql).all(...params));
}

/** INSERT/UPDATE/DELETE — returns { changes, lastInsertRowid } */
function run(sql, params = []) {
  return execWithAutoRepair(() => db.prepare(sql).run(...params));
}

/** Execute multiple statements (no params) */
function execMulti(sql) {
  return execWithAutoRepair(() => db.exec(sql));
}

/** Run inside a transaction */
function transaction(fn) {
  return db.transaction(fn)();
}

/** Get the database instance (for advanced usage) */
function getDb() {
  return db;
}

// ── Sync Log helper local ──
function logSync() {}

// ── Audit Log helper ──
function logAudit(userId, action, details, ip, tenantId) {
  run(
    'INSERT INTO audit_log (user_id, action, details, ip, tenant_id) VALUES (?, ?, ?, ?, ?)',
    [userId, action, JSON.stringify(details || {}), ip || '', tenantId || null]
  );
}

// ── Graceful shutdown: checkpoint WAL and close connection ──
function closeDatabase() {
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    console.log('[DB] Banco de dados fechado com sucesso');
  } catch (err) {
    console.error('[DB] Erro ao fechar banco:', err.message);
  }
}

module.exports = {
  initDatabase,
  queryOne,
  queryAll,
  run,
  execMulti,
  transaction,
  getDb,
  logSync,
  logAudit,
  closeDatabase,
};
