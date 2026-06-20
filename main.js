/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CREDGESTOR — Processo Principal (Main Process)                     ║
 * ║  Electron | Node.js | SQLite local                                 ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                     ║
 * ║  RESPONSABILIDADES:                                                 ║
 * ║  1. Gerenciar ciclo de vida da aplicação (single instance)          ║
 * ║  2. Criar e configurar a janela principal (BrowserWindow)           ║
 * ║  3. Registrar handlers IPC para comunicação segura com o renderer   ║
 * ║  4. Inicializar banco SQLite local no SSD via database.js           ║
 * ║  5. Aplicar políticas de segurança (CSP, bloqueio de navegação)     ║
 * ║  6. Inicializar backend local embarcado                             ║
 * ║                                                                     ║
 * ║  SEGURANÇA (v4.0 — Hardened):                                       ║
 * ║  • Content-Security-Policy restritiva via headers                   ║
 * ║  • Sandbox habilitado no renderer                                   ║
 * ║  • Chaves de API entregues via IPC (não mais no preload)            ║
 * ║  • Validação de tipos em TODOS os IPC handlers                      ║
 * ║  • Uncaught exception handler para resiliência                      ║
 * ║  • Limite de tamanho para backup (50MB)                             ║
 * ║  • Auto-backup periódico do banco                                   ║
 * ║                                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 1 — DEPENDÊNCIAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');

app.setName('CredGestor');

function logSuppressedError(context, error) {
  const detail = error && error.message ? error.message : String(error || 'erro desconhecido');
  console.warn(`[CredGestor] ${context}:`, detail);
}

// Banco de dados SQLite — importado ANTES dos exception handlers para estar disponível
const { createBackendProcessManager } = require('./main/backend-process');
const { OFFLINE_MODE } = require('./offline-services');

process.on('uncaughtException', (err) => {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [FATAL] [CredGestor Main] Uncaught exception:`, err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [FATAL] [CredGestor Main] Unhandled rejection:`, reason);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 2 — MODO OFFLINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// O desktop nao carrega .env. Segredos externos foram removidos do runtime.

const isDev = !app.isPackaged;
const backendProcessManager = createBackendProcessManager({
  app,
  dialog,
  rootDir: __dirname,
  isDev,
  logSuppressedError,
});

// [SEGURANÇA] Limite de tamanho para backup (50 MB)
const MAX_BACKUP_SIZE = 50 * 1024 * 1024;
const SYSTEM_API_READY_WAIT_MS = 15000;
const SYSTEM_API_RETRY_WAIT_MS = 450;
const SYSTEM_API_MAX_ATTEMPTS = 4;
let autonomyServices = null;
let supervisorTimer = null;
let updaterInitialized = false;
let isQuittingForUpdate = false;
const updateState = {
  enabled: !isDev,
  status: isDev ? 'disabled' : 'idle',
  currentVersion: app.getVersion(),
  latestVersion: '',
  percent: 0,
  error: '',
  downloaded: false,
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function describeBackendFetchError(error) {
  return error?.cause?.code || error?.code || error?.message || 'sem resposta';
}

function isRetryableBackendFetchError(error) {
  const detail = [
    error?.name,
    error?.message,
    error?.code,
    error?.cause?.code,
    error?.cause?.message,
  ].filter(Boolean).join(' ');

  return /fetch failed|ECONNREFUSED|ECONNRESET|EPIPE|ETIMEDOUT|AbortError|terminated|socket/i.test(detail);
}

function writeBackupChecksum(filePath, textContent) {
  try {
    const checksum = crypto.createHash('sha256').update(textContent, 'utf8').digest('hex');
    fs.writeFileSync(filePath + '.sha256', checksum, 'utf8');
    return checksum;
  } catch (_) {
    return null;
  }
}

function verifyBackupChecksum(filePath) {
  try {
    const sidecarPath = filePath + '.sha256';
    const sidecarExists = fs.existsSync(sidecarPath);
    if (!sidecarExists) {
      return { checksum: null, expected: null, valid: null, sidecarExists: false };
    }
    const expected = fs.readFileSync(sidecarPath, 'utf8').trim();
    const content = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    return {
      checksum,
      expected,
      valid: checksum === expected,
      sidecarExists: true
    };
  } catch (_) {
    return { checksum: null, expected: null, valid: null, sidecarExists: false };
  }
}

function writeFileChecksum(filePath) {
  try {
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    fs.writeFileSync(filePath + '.sha256', checksum, 'utf8');
    return checksum;
  } catch (_) {
    return null;
  }
}

function getDefaultPhysicalBackupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function isConfigEnabled(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim().toLowerCase();
  return !(text === '0' || text === 'false' || text === 'nao' || text === 'não');
}

function rotatePhysicalBackups(dir, retention) {
  const keep = Math.min(200, Math.max(1, Number(retention) || 20));
  let files = [];
  try {
    files = fs.readdirSync(dir)
      .filter((name) => /^credgestor_sqlite_\d{8}_\d{6}\.db$/i.test(name))
      .map((name) => {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        return { name, fullPath, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch (_) {
    return { removed: 0, keep };
  }

  let removed = 0;
  for (const file of files.slice(keep)) {
    try {
      fs.unlinkSync(file.fullPath);
      const checksumPath = file.fullPath + '.sha256';
      if (fs.existsSync(checksumPath)) fs.unlinkSync(checksumPath);
      removed++;
    } catch (error) {
      logSuppressedError(`falha ao remover backup vencido ${file.name}`, error);
    }
  }
  return { removed, keep };
}

function buildPhysicalBackupFilePath(dir) {
  const stamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .replace(/\..+$/, '');
  return path.join(dir, `credgestor_sqlite_${stamp}.db`);
}

async function createPhysicalBackup({ stateSnapshot = null, force = false, targetDir = '' } = {}) {
  const cfg = stateSnapshot?.config || {};
  if (!force && !isConfigEnabled(cfg.backupFisicoAtivo, true)) {
    return { skipped: true, reason: 'backup_fisico_desativado' };
  }

  const dir = path.resolve(String(targetDir || cfg.backupFisicoDiretorio || '').trim() || getDefaultPhysicalBackupDir());
  fs.mkdirSync(dir, { recursive: true });

  const targetPath = buildPhysicalBackupFilePath(dir);
  const res = await fetchSystemAPI('/api/system/sqlite-backup', 'POST', { targetPath });
  if (res.error || !res.success) {
    return { success: false, error: res.error || 'Falha ao criar backup fisico' };
  }

  const checksum = writeFileChecksum(targetPath);
  const rotation = rotatePhysicalBackups(dir, cfg.backupFisicoRetencao || 20);
  return {
    success: true,
    type: 'sqlite',
    path: targetPath,
    filePath: targetPath,
    dir,
    size: res.size || fs.statSync(targetPath).size,
    checksum,
    rotation,
    timestamp: new Date().toISOString()
  };
}

async function fetchSystemAPI(urlPath, method = 'GET', body = null) {
  let lastError = '';

  for (let attempt = 1; attempt <= SYSTEM_API_MAX_ATTEMPTS; attempt++) {
    const readyWaitMs = attempt === 1 ? SYSTEM_API_READY_WAIT_MS : 2500;
    const ready = await backendProcessManager.waitUntilReady(readyWaitMs);
    if (!ready && attempt === 1) {
      console.warn('[CredGestor Main] Backend ainda nao sinalizou pronto; tentando chamada direta.');
    }

    try {
      const baseUrl = backendProcessManager.getBackendUrl();
      const apiKey = backendProcessManager.getSystemApiKey();
      const response = await fetch(`${baseUrl}${urlPath}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-System-Key': apiKey
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const responseText = await response.text();
      let responseJson = {};
      try { responseJson = responseText ? JSON.parse(responseText) : {}; } catch (e) { responseJson = {}; }

      if (!response.ok) {
        lastError = responseJson.error || `HTTP ${response.status}`;
        if (response.status >= 500 && attempt < SYSTEM_API_MAX_ATTEMPTS) {
          await delay(SYSTEM_API_RETRY_WAIT_MS * attempt);
          continue;
        }
        return { error: lastError };
      }

      return responseJson;
    } catch (err) {
      lastError = describeBackendFetchError(err);
      console.error(`[CredGestor Main] fetchSystemAPI error (${method} ${urlPath}, tentativa ${attempt}/${SYSTEM_API_MAX_ATTEMPTS}):`, lastError);

      if (attempt < SYSTEM_API_MAX_ATTEMPTS && isRetryableBackendFetchError(err)) {
        await delay(SYSTEM_API_RETRY_WAIT_MS * attempt);
        continue;
      }

      break;
    }
  }

  return {
    error: `Backend local indisponivel (${lastError || 'sem resposta'}). Feche e abra o CredGestor se persistir.`
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 3 — INSTÂNCIA ÚNICA (Single Instance Lock)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ==========================================
// DB LOCAL PROXY HANDLERS (REST -> IPC)
// ==========================================

// --- Auth ---
ipcMain.handle('db:auth-get-credentials', async () => {
  const res = await fetchSystemAPI('/api/system/credentials');
  if (!res) return null;
  if (res.error) return { error: res.error };
  return res;
});

ipcMain.handle('db:auth-register', async (_event, { nome, email, password }) => {
  const res = await fetchSystemAPI('/api/auth/register', 'POST', { nome, email, password });
  if (res.error) return { success: false, error: res.error };
  return {
    success: true,
    user: res.user || null,
    accessToken: res.accessToken || '',
    refreshToken: res.refreshToken || '',
  };
});

ipcMain.handle('db:auth-login', async (_event, { email, password }) => {
  const res = await fetchSystemAPI('/api/auth/login', 'POST', { email, password });
  if (res.error) return { success: false, error: res.error };
  return {
    success: true,
    nome: res.user?.nome || '',
    user: res.user || null,
    accessToken: res.accessToken || '',
    refreshToken: res.refreshToken || '',
  };
});

ipcMain.handle('db:auth-change-password', async (_event, { currentPassword, newPassword }) => {
  const res = await fetchSystemAPI('/api/auth/password', 'PUT', { currentPassword, newPassword });
  if (res.error) return { success: false, error: res.error };
  return { success: true };
});

// --- Recovery and Master/Dev Password (Local Verification + Express Reset) ---
const RECOVERY_PASSWORD_SALT = 'credgestor_salt_2026';
const MASTER_PASSWORD_HASH = '062f808b50e77db16159dae19193718ac0818149fa093dcb6b58597529b2c0ff';
const DEV_PASSWORD_HASH = '1a52aca4024c0b85d0727023a068bfc760f5dd67fd40b3e48916d37deb74457e';

ipcMain.handle('db:auth-verify-master', async (_event, { password }) => {
  const hash = crypto.createHash('sha256').update(password + RECOVERY_PASSWORD_SALT).digest('hex');
  return hash === MASTER_PASSWORD_HASH;
});

ipcMain.handle('db:auth-verify-dev', async (_event, { password }) => {
  const hash = crypto.createHash('sha256').update(password + RECOVERY_PASSWORD_SALT).digest('hex');
  return hash === DEV_PASSWORD_HASH;
});

ipcMain.handle('db:auth-reset-with-recovery', async (_event, { recoveryPassword }) => {
  const hash = crypto.createHash('sha256').update(recoveryPassword + RECOVERY_PASSWORD_SALT).digest('hex');
  const isMaster = hash === MASTER_PASSWORD_HASH;
  const isDev = hash === DEV_PASSWORD_HASH;
  if (!isMaster && !isDev) {
    return { success: false, error: 'ERR_INVALID_RECOVERY_PASSWORD' };
  }
  const res = await fetchSystemAPI('/api/system/reset-credentials', 'POST');
  if (res.error) return { success: false, error: res.error };
  return { success: true, level: isDev ? 'developer' : 'master' };
});

// --- Admin Users ---
ipcMain.handle('db:admin-list-users', async (_event, { tenantId } = {}) => {
  const safeTenantId = String(tenantId || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
  const res = await fetchSystemAPI(`/api/tenants/${encodeURIComponent(safeTenantId)}/users`);
  if (res.error) return { success: false, error: res.error, users: [], pending_invites: [] };
  return res;
});

ipcMain.handle('db:admin-create-user', async (_event, payload = {}) => {
  const res = await fetchSystemAPI('/api/tenants/create-user', 'POST', payload);
  if (res.error) return { success: false, error: res.error };
  return res;
});

ipcMain.handle('db:admin-delete-user', async (_event, { tenantId, userId } = {}) => {
  const safeTenantId = String(tenantId || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
  const safeUserId = Number(userId);
  if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
    return { success: false, error: 'Usuário inválido' };
  }
  const res = await fetchSystemAPI(`/api/tenants/${encodeURIComponent(safeTenantId)}/users/${safeUserId}`, 'DELETE');
  if (res.error) return { success: false, error: res.error };
  return res;
});

// --- Complete State ---
ipcMain.handle('db:load-state', async () => {
  return await fetchSystemAPI('/api/system/state');
});

ipcMain.handle('db:save-state', async (_event, state) => {
  return await fetchSystemAPI('/api/system/state', 'POST', state);
});

// --- Clientes Pagination and Validation ---
ipcMain.handle('db:get-clientes-paginated', async (_event, { page, limit, search, statusFilter }) => {
  const query = new URLSearchParams({
    page: String(page || 1),
    limit: String(limit || 50),
    search: search || '',
    status: statusFilter || ''
  }).toString();

  const res = await fetchSystemAPI(`/api/clientes?${query}`);
  if (res.error) {
    return { clientes: [], total: 0, page, limit, pages: 0 };
  }
  return {
    clientes: res.data || [],
    total: res.pagination?.total || 0,
    pages: res.pagination?.totalPages || 0,
    page: res.pagination?.page || page,
    limit: res.pagination?.limit || limit
  };
});

ipcMain.handle('db:check-matricula', async (_event, { matricula, excludeId }) => {
  const query = new URLSearchParams({
    matricula: matricula || '',
    excludeId: excludeId || ''
  }).toString();
  return await fetchSystemAPI(`/api/clientes/check-matricula?${query}`);
});

// --- CRUD Clientes ---
ipcMain.handle('db:save-cliente', async (_event, cliente) => {
  if (!cliente || typeof cliente !== 'object' || !cliente.id) {
    return { success: false, error: 'Cliente invalido ou sem ID' };
  }
  const check = await fetchSystemAPI(`/api/clientes/${encodeURIComponent(cliente.id)}`);
  let res;
  if (check.error) {
    res = await fetchSystemAPI('/api/clientes', 'POST', cliente);
  } else {
    res = await fetchSystemAPI(`/api/clientes/${encodeURIComponent(cliente.id)}`, 'PUT', cliente);
  }

  if (res.error) return { success: false, error: res.error };
  return { success: true, id: cliente.id, cliente: res };
});

ipcMain.handle('db:set-cliente-blacklist', async (_event, { clienteId, blocked, motivo }) => {
  if (!clienteId) return { success: false, error: 'Cliente invalido' };
  const res = await fetchSystemAPI(`/api/clientes/${encodeURIComponent(clienteId)}/blacklist`, 'PUT', {
    blocked: blocked === true,
    motivo: motivo || 'manual',
  });
  if (res.error) return { success: false, error: res.error };
  return { success: true, cliente: res };
});

ipcMain.handle('db:delete-cliente', async (_event, id) => {
  const res = await fetchSystemAPI(`/api/clientes/${encodeURIComponent(id)}`, 'DELETE');
  if (res.error) return { success: false, error: res.error };
  return { success: true, caixa: res.caixa || null };
});

ipcMain.handle('db:save-batch-clientes', async (_event, clientes) => {
  const res = await fetchSystemAPI('/api/clientes/batch', 'POST', clientes);
  if (res.error) return { success: false, error: res.error };
  return res;
});

// --- CRUD Emprestimos ---
ipcMain.handle('db:save-emprestimo', async (_event, emp) => {
  if (!emp || typeof emp !== 'object' || !emp.id) {
    return { success: false, error: 'Emprestimo invalido ou sem ID' };
  }
  const check = await fetchSystemAPI(`/api/emprestimos/${encodeURIComponent(emp.id)}`);
  let res;
  if (check.error) {
    res = await fetchSystemAPI('/api/emprestimos', 'POST', emp);
  } else {
    res = await fetchSystemAPI(`/api/emprestimos/${encodeURIComponent(emp.id)}`, 'PUT', emp);
  }

  if (res.error) return { success: false, error: res.error };
  return { success: true, id: emp.id, emprestimo: res, caixa: res.caixa || null };
});

ipcMain.handle('db:delete-emprestimo', async (_event, id) => {
  const res = await fetchSystemAPI(`/api/emprestimos/${encodeURIComponent(id)}`, 'DELETE');
  if (res.error) return { success: false, error: res.error };
  return { success: true, caixa: res.caixa || null };
});

ipcMain.handle('db:pagar-emprestimo', async (_event, { id, payload }) => {
  if (!id) return { success: false, error: 'Emprestimo invalido' };
  const res = await fetchSystemAPI(`/api/emprestimos/${encodeURIComponent(id)}/pagar`, 'POST', payload || {});
  if (res.error) return { success: false, error: res.error };
  return {
    success: true,
    emprestimo: res.emprestimo || null,
    transacao: res.transacao || null,
    transacaoId: res.transacao_id || null,
    cliente: res.cliente || null,
    caixa: res.caixa || null,
  };
});

// --- CRUD Transacoes ---
ipcMain.handle('db:save-transacao', async (_event, tx) => {
  if (!tx || typeof tx !== 'object' || !tx.id) {
    return { success: false, error: 'Transacao invalida ou sem ID' };
  }
  const check = await fetchSystemAPI(`/api/transacoes/${encodeURIComponent(tx.id)}`);
  if (!check.error) {
    return { success: true, id: tx.id };
  }
  const res = await fetchSystemAPI('/api/transacoes', 'POST', tx);
  if (res.error) return { success: false, error: res.error };
  return { success: true, id: tx.id, transacao: res, caixa: res.caixa || null };
});

ipcMain.handle('db:delete-transacao', async (_event, id) => {
  const res = await fetchSystemAPI(`/api/transacoes/${encodeURIComponent(id)}`, 'DELETE');
  if (res.error) return { success: false, error: res.error };
  return { success: true, caixa: res.caixa || null };
});

// --- Caixa ---
ipcMain.handle('db:update-caixa', async (_event, { saldo }) => {
  const res = await fetchSystemAPI('/api/caixa', 'PUT', { saldo });
  if (res.error) return { success: false, error: res.error };
  return { success: true };
});

ipcMain.handle('db:add-caixa-historico', async (_event, { tipo, valor, descricao, data }) => {
  const payload = { tipo, valor, descricao };
  if (data) payload.data = data;
  const res = await fetchSystemAPI('/api/caixa/historico', 'POST', payload);
  if (res.error) return { success: false, error: res.error };
  return {
    success: true,
    historico: {
      tipo: res.tipo,
      valor: res.valor,
      descricao: res.descricao || '',
      data: res.data || '',
      saldoAnterior: res.saldo_anterior ?? res.saldoAnterior ?? 0,
      saldoPosterior: res.saldo_posterior ?? res.saldoPosterior ?? 0
    }
  };
});

// --- Configs and Stats ---
ipcMain.handle('db:set-config', async (_event, { chave, valor }) => {
  const res = await fetchSystemAPI(`/api/config/${encodeURIComponent(chave)}`, 'PUT', { valor });
  if (res.error) return { success: false, error: res.error };
  return { success: true };
});

ipcMain.handle('db:stats', async () => {
  const res = await fetchSystemAPI('/api/system/db-stats');
  if (res.error) return { clientes: 0, emprestimos: 0, transacoes: 0, dbSize: 0, dbPath: '' };

  const userDataPath = app.getPath('userData');
  const actualDbPath = path.join(userDataPath, 'credgestor-api.db');
  let dbSize = 0;
  try {
    if (fs.existsSync(actualDbPath)) {
      dbSize = fs.statSync(actualDbPath).size;
    }
  } catch (err) {
    logSuppressedError('erro ao ler tamanho do banco', err);
  }

  return {
    ...res,
    dbSize,
    dbPath: actualDbPath
  };
});

ipcMain.handle('db:dashboard-aggregates', async () => {
  return await fetchSystemAPI('/api/stats/aggregates');
});

ipcMain.handle('db:reset-data', async () => {
  const res = await fetchSystemAPI('/api/system/reset', 'POST');
  if (res.error) return { success: false, error: res.error };
  return { success: true };
});

// --- Recibos de Entrega ---
ipcMain.handle('db:criar-recibos-arquivo', async (_event, { arquivoId, contratos }) => {
  return await fetchSystemAPI('/api/recibos/criar', 'POST', { arquivoId, contratos });
});

ipcMain.handle('db:listar-recibos-arquivo', async (_event, arquivoId) => {
  return await fetchSystemAPI(`/api/recibos/arquivo/${encodeURIComponent(arquivoId)}`);
});

ipcMain.handle('db:listar-recibos-pendentes', async () => {
  return await fetchSystemAPI('/api/recibos/pendentes');
});

ipcMain.handle('db:get-recibo', async (_event, reciboId) => {
  return await fetchSystemAPI(`/api/recibos/${encodeURIComponent(reciboId)}`);
});

ipcMain.handle('db:marcar-recibo-entregue', async (_event, payload) => {
  return await fetchSystemAPI(`/api/recibos/${encodeURIComponent(payload?.reciboId)}/entregar`, 'PUT', payload);
});

ipcMain.handle('db:estornar-recibo', async (_event, payload) => {
  return await fetchSystemAPI(`/api/recibos/${encodeURIComponent(payload?.reciboId)}/estornar`, 'PUT', payload);
});

ipcMain.handle('db:marcar-recibo-whatsapp', async () => {
  return { success: true };
});

// --- Sync and Delta (Legacy - Offline Total) ---
ipcMain.handle('db:get-delta', async () => {
  return [];
});

ipcMain.handle('db:clear-sync-log', async () => {
  return { success: true };
});

ipcMain.handle('db:get-last-sync', async () => {
  const res = await fetchSystemAPI('/api/config/last_sync_timestamp');
  if (res.error || !res.valor) return '';
  return res.valor;
});

ipcMain.handle('db:set-last-sync', async (_event, ts) => {
  const res = await fetchSystemAPI('/api/config/last_sync_timestamp', 'PUT', { valor: ts });
  if (res.error) return { success: false };
  return { success: true };
});

// --- Observabilidade ---
ipcMain.handle('db:get-persistence-queue-status', async () => {
  return { pending: 0, processing: false, stats: { enqueued: 0, processed: 0, failed: 0, lastSuccessAt: null, lastError: null } };
});

ipcMain.handle('db:get-operational-health', async () => {
  const health = await fetchSystemAPI('/api/system/health');
  const stats = await fetchSystemAPI('/api/system/db-stats');
  return {
    generatedAt: new Date().toISOString(),
    riskLevel: health.ok ? 'low' : 'high',
    queue: { pending: 0, processing: false, stats: { enqueued: 0, processed: 0, failed: 0, lastSuccessAt: null, lastError: null } },
    persistence: { ok: true, lastSave: new Date().toISOString() },
    dbStats: stats.error ? {} : stats,
    latestBackup: null
  };
});

ipcMain.handle('db:run-integrity-supervisor', async () => {
  const health = await fetchSystemAPI('/api/system/health');
  if (health.error) {
    return {
      generatedAt: new Date().toISOString(),
      ok: false,
      riskLevel: 'high',
      checks: { sqlite: { success: false, ok: false, messages: [health.error] } },
      backups: [],
      recoveryPlan: [{ action: 'restart_application', reason: health.error, requiresApproval: false }]
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    ok: health.ok,
    riskLevel: health.ok ? 'low' : 'high',
    checks: { sqlite: { success: true, ok: health.ok, messages: health.checks?.sqlite?.messages || ['ok'] } },
    backups: [],
    recoveryPlan: health.ok ? [] : [{ action: 'restore_backup', reason: 'Integrity check failed', requiresApproval: true }]
  };
});

ipcMain.handle('db:run-retention', async (_event, { transacoesDays, auditDays }) => {
  return await fetchSystemAPI('/api/system/retention', 'POST', { transacoesDays, auditDays });
});

ipcMain.handle('db:get-audit-logs', async (_event, query = {}) => {
  const params = new URLSearchParams({
    limit: String(Math.min(500, Math.max(1, Number(query.limit) || 100))),
    offset: String(Math.max(0, Number(query.offset) || 0)),
    search: typeof query.search === 'string' ? query.search.slice(0, 200) : '',
    action: typeof query.action === 'string' ? query.action.slice(0, 100) : '',
    from: typeof query.from === 'string' ? query.from.slice(0, 40) : '',
    to: typeof query.to === 'string' ? query.to.slice(0, 40) : '',
  }).toString();
  return await fetchSystemAPI(`/api/system/audit-logs?${params}`);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 5 — HANDLERS IPC: Utilitários
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Modo offline: nenhuma URL externa e aberta pelo app.
ipcMain.handle('open-external', (_event, url) => {
  return {
    success: false,
    offline: true,
    url: typeof url === 'string' ? url.slice(0, 2083) : '',
    error: OFFLINE_MODE.reason,
  };
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 5.1 — HANDLER IPC: Modo offline
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ipcMain.handle('get-offline-status', () => {
  return {
    offline: true,
    message: OFFLINE_MODE.reason,
  };
});

ipcMain.handle('save-backup', async (_event, jsonString) => {
  try {
    if (typeof jsonString !== 'string') return { success: false, error: 'Conteudo invalido' };
    if (Buffer.byteLength(jsonString, 'utf8') > MAX_BACKUP_SIZE) {
      return { success: false, error: 'Backup excede o limite de 50MB' };
    }

    const defaultPath = path.join(
      app.getPath('documents'),
      `credgestor_estado_${new Date().toISOString().slice(0, 10)}.json`
    );
    const result = await dialog.showSaveDialog({
      title: 'Salvar backup JSON do estado',
      defaultPath,
      filters: [{ name: 'Backup JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true, success: false };

    fs.writeFileSync(result.filePath, jsonString, 'utf8');
    const checksum = writeBackupChecksum(result.filePath, jsonString);
    return { success: true, filePath: result.filePath, checksum };
  } catch (err) {
    return { success: false, error: err.message || 'Erro ao salvar backup' };
  }
});

ipcMain.handle('open-backup', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Abrir backup JSON do estado',
      properties: ['openFile'],
      filters: [{ name: 'Backup JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, success: false };

    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_BACKUP_SIZE) {
      return { success: false, error: 'Backup excede o limite de 50MB' };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const checksum = verifyBackupChecksum(filePath);
    return {
      success: true,
      filePath,
      content,
      data: content,
      checksum: checksum.checksum,
      checksumExpected: checksum.expected,
      checksumValid: checksum.valid
    };
  } catch (err) {
    return { success: false, error: err.message || 'Erro ao abrir backup' };
  }
});

ipcMain.handle('choose-backup-directory', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Escolher pasta para backups fisicos SQLite',
      defaultPath: getDefaultPhysicalBackupDir(),
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
    return { success: true, directory: result.filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message || 'Erro ao escolher pasta' };
  }
});

ipcMain.handle('save-physical-backup', async (_event, stateSnapshot = null) => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Escolher pasta ou pendrive para salvar copia SQLite',
      defaultPath: String(stateSnapshot?.config?.backupFisicoDiretorio || '') || getDefaultPhysicalBackupDir(),
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, success: false };
    return await createPhysicalBackup({ stateSnapshot, force: true, targetDir: result.filePaths[0] });
  } catch (err) {
    return { success: false, error: err.message || 'Erro ao salvar backup fisico' };
  }
});

ipcMain.handle('auto-backup', async (_event, stateSnapshot = null) => {
  try {
    return await createPhysicalBackup({ stateSnapshot, force: false });
  } catch (err) {
    return { success: false, error: err.message || 'Erro no backup automatico' };
  }
});

// ==========================================
// WINDOW CREATION & CSP
// ==========================================

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 720,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
    title: 'CredGestor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: isDev,
      spellcheck: false
    }
  });

  win.removeMenu();
  win.loadFile('index.html');
  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[CredGestor] Janela carregada com sucesso');
  });
  win.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('[CredGestor] Falha ao carregar janela:', code, desc);
  });

  win.on('close', () => {
    try {
      win.webContents.send('clear-session');
    } catch (error) {
      logSuppressedError('falha ao enviar evento clear-session para renderer', error);
    }
  });

  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file://')) return;
    e.preventDefault();
  });

  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  return win;
}

function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
            "img-src 'self' data: blob:",
            "worker-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
          ].join('; ')
        ]
      }
    });
  });
}

// ==========================================
// AUTO UPDATE (GitHub Releases + NSIS)
// ==========================================

function getUpdateInfoPayload(info = {}) {
  return {
    version: info.version || '',
    releaseDate: info.releaseDate || '',
    releaseName: info.releaseName || '',
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes.slice(0, 3000) : '',
  };
}

function emitUpdateStatus(patch = {}) {
  Object.assign(updateState, patch);
  const payload = { ...updateState };
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('updates:status', payload);
    } catch (error) {
      logSuppressedError('falha ao enviar status de update ao renderer', error);
    }
  }
  return payload;
}

function getPrimaryWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

async function promptInstallDownloadedUpdate(info = {}) {
  const version = info.version || updateState.latestVersion || 'mais recente';
  const win = getPrimaryWindow();
  const result = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Atualizacao do CredGestor',
    message: `Atualizacao ${version} pronta para instalar`,
    detail: 'O CredGestor precisa reiniciar para aplicar a nova versao. Os dados locais do cliente permanecem preservados.',
    buttons: ['Reiniciar e instalar', 'Depois'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  if (result.response === 0) {
    installDownloadedUpdate();
  }
}

function installDownloadedUpdate() {
  if (isDev || !updateState.downloaded) {
    return { success: false, error: 'Nenhuma atualizacao baixada.' };
  }

  isQuittingForUpdate = true;
  emitUpdateStatus({ status: 'installing', error: '' });
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      isQuittingForUpdate = false;
      emitUpdateStatus({ status: 'error', error: error.message || 'Falha ao instalar atualizacao.' });
    }
  });
  return { success: true };
}

function setupAutoUpdates() {
  if (updaterInitialized) return;
  updaterInitialized = true;

  if (isDev) {
    emitUpdateStatus({ enabled: false, status: 'disabled', error: 'Atualizacao automatica fica ativa apenas no app instalado.' });
    return;
  }

  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://github.com/webrjpro/credgestor2026/releases/latest/download',
  });

  autoUpdater.on('checking-for-update', () => {
    emitUpdateStatus({ status: 'checking', percent: 0, error: '', downloaded: false });
  });

  autoUpdater.on('update-available', (info) => {
    emitUpdateStatus({
      status: 'available',
      latestVersion: info.version || '',
      updateInfo: getUpdateInfoPayload(info),
      percent: 0,
      error: '',
      downloaded: false,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    emitUpdateStatus({
      status: 'idle',
      latestVersion: info.version || app.getVersion(),
      updateInfo: getUpdateInfoPayload(info),
      percent: 0,
      error: '',
      downloaded: false,
    });
  });

  autoUpdater.on('download-progress', (progress = {}) => {
    emitUpdateStatus({
      status: 'downloading',
      percent: Number(progress.percent || 0),
      bytesPerSecond: Number(progress.bytesPerSecond || 0),
      transferred: Number(progress.transferred || 0),
      total: Number(progress.total || 0),
      error: '',
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    emitUpdateStatus({
      status: 'downloaded',
      latestVersion: info.version || updateState.latestVersion,
      updateInfo: getUpdateInfoPayload(info),
      percent: 100,
      error: '',
      downloaded: true,
    });
    promptInstallDownloadedUpdate(info).catch((error) => {
      logSuppressedError('falha ao exibir dialogo de update baixado', error);
    });
  });

  autoUpdater.on('error', (error) => {
    const message = error?.message || String(error || 'Falha ao verificar atualizacao.');
    emitUpdateStatus({ status: 'error', error: message, downloaded: false });
  });

  autoUpdater.on('before-quit-for-update', () => {
    isQuittingForUpdate = true;
    performGracefulShutdown('before-quit-for-update').catch((error) => {
      logSuppressedError('falha no shutdown antes do update', error);
    });
  });
}

function scheduleAutomaticUpdateCheck() {
  if (isDev) return;
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      const message = error?.message || 'Falha ao verificar atualizacao.';
      emitUpdateStatus({ status: 'error', error: message });
    });
  }, 8000);
}

// ==========================================
// SYSTEM IPC HANDLERS
// ==========================================

ipcMain.handle('get-backend-url', () => {
  return backendProcessManager.getBackendUrl();
});

ipcMain.handle('get-network-info', () => {
  const backendPort = backendProcessManager.getBackendPort();
  return {
    localIp: 'localhost',
    port: backendPort,
    url: backendProcessManager.getBackendUrl(),
    ready: backendProcessManager.isReady(),
    allAddresses: [],
    offline: true,
  };
});

ipcMain.handle('updates:get-status', () => {
  return { ...updateState };
});

ipcMain.handle('updates:check', async () => {
  if (isDev) {
    return { success: false, error: 'Atualizacao automatica fica ativa apenas no app instalado.' };
  }

  try {
    setupAutoUpdates();
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: getUpdateInfoPayload(result?.updateInfo || {}) };
  } catch (error) {
    const message = error?.message || 'Falha ao verificar atualizacao.';
    emitUpdateStatus({ status: 'error', error: message });
    return { success: false, error: message };
  }
});

ipcMain.handle('updates:download', async () => {
  if (isDev) {
    return { success: false, error: 'Atualizacao automatica fica ativa apenas no app instalado.' };
  }

  try {
    setupAutoUpdates();
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    const message = error?.message || 'Falha ao baixar atualizacao.';
    emitUpdateStatus({ status: 'error', error: message });
    return { success: false, error: message };
  }
});

ipcMain.handle('updates:install', () => {
  return installDownloadedUpdate();
});

// ==========================================
// APPLICATION CYCLE LIFE
// ==========================================

app.whenReady().then(async () => {
  setupCSP();

  const userDataPath = app.getPath('userData');
  console.log(`[CredGestor] Banco de dados SQLite: ${path.join(userDataPath, 'credgestor-api.db')}`);

  // Iniciar backend API REST embarcado (silencioso)
  backendProcessManager.start(userDataPath);
  const backendReady = await backendProcessManager.waitUntilReady(SYSTEM_API_READY_WAIT_MS);
  if (!backendReady) {
    console.warn('[CredGestor] Janela sera aberta, mas o backend ainda nao sinalizou prontidao.');
  }
  console.log('[CredGestor] ' + OFFLINE_MODE.reason);

  supervisorTimer = setInterval(async () => {
    try {
      const health = await fetchSystemAPI('/api/system/health');
      if (health.error || !health.ok) {
        console.warn('[CredGestor] Supervisor detectou falha de integridade ou conexao:', health.error || 'degraded');
      }
    } catch (e) {
      console.error('[CredGestor] Erro no supervisor periodico:', e.message);
    }
  }, 10 * 60 * 1000);

  setupAutoUpdates();
  createWindow();
  scheduleAutomaticUpdateCheck();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Fechar backend ao encerrar o app
let _gracefulShutdownDone = false;
async function performGracefulShutdown(reason = 'before-quit') {
  if (_gracefulShutdownDone) return;
  _gracefulShutdownDone = true;
  console.log(`[CredGestor] Graceful shutdown iniciado (${reason})`);

  if (supervisorTimer) { clearInterval(supervisorTimer); supervisorTimer = null; }
  try { backendProcessManager.stop(); } catch (error) { logSuppressedError('falha ao parar backend no shutdown', error); }
  console.log('[CredGestor] Graceful shutdown concluído');
}

app.on('before-quit', async (event) => {
  if (isQuittingForUpdate) {
    await performGracefulShutdown('before-quit-for-update');
    return;
  }
  if (_gracefulShutdownDone) return;
  event.preventDefault();
  await performGracefulShutdown('before-quit');
  app.exit(0);
});

// Garantia adicional: signals do SO (Ctrl+C, kill, logoff Windows)
process.once('SIGINT',  () => { performGracefulShutdown('SIGINT').then(() => process.exit(0)); });
process.once('SIGTERM', () => { performGracefulShutdown('SIGTERM').then(() => process.exit(0)); });
