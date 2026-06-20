/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CREDGESTOR — Preload (Ponte de Segurança)                         ║
 * ║  Electron 28+ | contextBridge | SQLite via IPC                     ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                     ║
 * ║  SEGURANÇA (v4.0 — Hardened):                                       ║
 * ║  • Produto offline: nenhum segredo externo exposto ao renderer      ║
 * ║  • Compatível com sandbox: true (sem require de módulos Node)       ║
 * ║  • Apenas ipcRenderer.invoke() — nunca ipcRenderer.send()           ║
 * ║  • Sanitização de inputs antes de enviar ao main process            ║
 * ║  • Nenhum dado sensível exposto no window global                    ║
 * ║                                                                     ║
 * ║  APIs EXPOSTAS AO RENDERER:                                         ║
 * ║  • window.secureConfig.getOfflineStatus()   → status offline        ║
 * ║  • window.electronAPI.openExternal(url)     → bloqueado offline     ║
 * ║  • window.electronAPI.saveBackup(json)      → backup pendrive       ║
 * ║  • window.electronAPI.openBackup()          → restore pendrive      ║
 * ║  • window.electronAPI.isElectron            → flag booleana         ║
 * ║  • window.db.*                              → acesso ao SQLite      ║
 * ║                                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const { contextBridge, ipcRenderer } = require('electron');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS DE SANITIZAÇÃO (camada de defesa antes do IPC)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Garante que o valor é uma string, truncando se necessário.
 * @param {*} val
 * @param {number} [maxLen=1000]
 * @returns {string}
 */
function safeStr(val, maxLen = 1000) {
  return typeof val === 'string' ? val.slice(0, maxLen) : '';
}

/**
 * Garante que o valor é um número finito.
 * @param {*} val
 * @param {number} [fallback=0]
 * @returns {number}
 */
function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// ── Status offline e backend local ──
contextBridge.exposeInMainWorld('secureConfig', {
  getOfflineStatus: () => ipcRenderer.invoke('get-offline-status'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
});

// ── Electron API ──
contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => {
    if (typeof url !== 'string' || url.length > 2083) return Promise.resolve();
    return ipcRenderer.invoke('open-external', url);
  },
  saveBackup: (jsonString) => {
    if (typeof jsonString !== 'string') return Promise.resolve({ success: false });
    return ipcRenderer.invoke('save-backup', jsonString);
  },
  openBackup: () => ipcRenderer.invoke('open-backup'),
  autoBackup: (state) => ipcRenderer.invoke('auto-backup', state),
  savePhysicalBackup: (state) => ipcRenderer.invoke('save-physical-backup', state),
  chooseBackupDirectory: () => ipcRenderer.invoke('choose-backup-directory'),
  updates: {
    getStatus: () => ipcRenderer.invoke('updates:get-status'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    onStatus: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => callback(payload || {});
      ipcRenderer.on('updates:status', listener);
      return () => ipcRenderer.removeListener('updates:status', listener);
    }
  },
  isElectron: true,
  onClearSession: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('clear-session', () => callback());
  }
});

// ── Banco de Dados SQLite (via IPC seguro) ──
contextBridge.exposeInMainWorld('db', {
  // Auth
  getCredentials: () => ipcRenderer.invoke('db:auth-get-credentials'),
  register: (nome, email, password) => ipcRenderer.invoke('db:auth-register', {
    nome: safeStr(nome, 500),
    email: safeStr(email, 254),
    password: safeStr(password, 128)
  }),
  login: (email, password) => ipcRenderer.invoke('db:auth-login', {
    email: safeStr(email, 254),
    password: safeStr(password, 128)
  }),
  changePassword: (currentPassword, newPassword) => ipcRenderer.invoke('db:auth-change-password', {
    currentPassword: safeStr(currentPassword, 128),
    newPassword: safeStr(newPassword, 128)
  }),

  // Senhas de Recuperação (Master / Dev)
  verifyMasterPassword: (password) => ipcRenderer.invoke('db:auth-verify-master', {
    password: safeStr(password, 128)
  }),
  verifyDevPassword: (password) => ipcRenderer.invoke('db:auth-verify-dev', {
    password: safeStr(password, 128)
  }),
  resetWithRecovery: (recoveryPassword) => ipcRenderer.invoke('db:auth-reset-with-recovery', {
    recoveryPassword: safeStr(recoveryPassword, 128)
  }),
  adminListUsers: (tenantId = 'default') => ipcRenderer.invoke('db:admin-list-users', {
    tenantId: safeStr(tenantId, 100)
  }),
  adminCreateUser: (payload = {}) => ipcRenderer.invoke('db:admin-create-user', {
    nome: safeStr(payload?.nome, 100),
    email: safeStr(payload?.email, 254),
    password: safeStr(payload?.password, 128),
    role: safeStr(payload?.role, 20)
  }),
  adminDeleteUser: (tenantId = 'default', userId = 0) => ipcRenderer.invoke('db:admin-delete-user', {
    tenantId: safeStr(tenantId, 100),
    userId: Math.max(0, Math.trunc(safeNum(userId, 0)))
  }),

  // Estado Completo (compat com frontend existente)
  loadState: () => ipcRenderer.invoke('db:load-state'),
  saveState: (state) => ipcRenderer.invoke('db:save-state', state),
  getClientesPaginated: (page, limit, search, statusFilter) => ipcRenderer.invoke('db:get-clientes-paginated', {
    page: Math.max(1, Math.trunc(safeNum(page, 1))),
    limit: Math.max(1, Math.trunc(safeNum(limit, 50))),
    search: safeStr(search, 200),
    statusFilter: safeStr(statusFilter, 20)
  }),
  checkMatricula: (matricula, excludeId = '') => ipcRenderer.invoke('db:check-matricula', {
    matricula: safeStr(matricula, 120),
    excludeId: safeStr(excludeId, 100)
  }),

  // CRUD individual (mais eficiente)
  saveCliente: (cliente) => ipcRenderer.invoke('db:save-cliente', cliente),
  setClienteBlacklist: (payload) => ipcRenderer.invoke('db:set-cliente-blacklist', {
    clienteId: safeStr(payload?.clienteId, 100),
    blocked: !!payload?.blocked,
    motivo: safeStr(payload?.motivo, 100)
  }),
  deleteCliente: (id) => ipcRenderer.invoke('db:delete-cliente', id),
  saveEmprestimo: (emp) => ipcRenderer.invoke('db:save-emprestimo', emp),
  deleteEmprestimo: (id) => ipcRenderer.invoke('db:delete-emprestimo', id),
  pagarEmprestimo: (id, payload) => ipcRenderer.invoke('db:pagar-emprestimo', {
    id: safeStr(id, 100),
    payload: payload && typeof payload === 'object' ? payload : {}
  }),
  saveTransacao: (tx) => ipcRenderer.invoke('db:save-transacao', tx),
  deleteTransacao: (id) => ipcRenderer.invoke('db:delete-transacao', id),
  saveBatchClientes: (clientes) => {
    if (!Array.isArray(clientes)) return Promise.resolve({ success: false });
    return ipcRenderer.invoke('db:save-batch-clientes', clientes);
  },
  updateCaixa: (saldo) => ipcRenderer.invoke('db:update-caixa', { saldo: safeNum(saldo) }),
  addCaixaHistorico: (tipo, valor, descricao, saldoAnterior, saldoPosterior, data) =>
    ipcRenderer.invoke('db:add-caixa-historico', {
      tipo: safeStr(tipo, 50),
      valor: safeNum(valor),
      descricao: safeStr(descricao, 500),
      saldoAnterior: safeNum(saldoAnterior),
      saldoPosterior: safeNum(saldoPosterior),
      data: safeStr(data, 40)
    }),
  setConfig: (chave, valor) => ipcRenderer.invoke('db:set-config', {
    chave: safeStr(chave, 100),
    valor: safeStr(valor, 5000)
  }),
  getStats: () => ipcRenderer.invoke('db:stats'),
  getDashboardAggregates: () => ipcRenderer.invoke('db:dashboard-aggregates'),
  resetData: () => ipcRenderer.invoke('db:reset-data'),

  // Recibos de Entrega
  criarRecibosArquivo: (arquivoId, contratos) =>
    ipcRenderer.invoke('db:criar-recibos-arquivo', { arquivoId: safeStr(arquivoId, 100), contratos }),
  listarRecibosArquivo: (arquivoId) =>
    ipcRenderer.invoke('db:listar-recibos-arquivo', safeStr(arquivoId, 100)),
  listarRecibosPendentes: () => ipcRenderer.invoke('db:listar-recibos-pendentes'),
  getRecibo: (reciboId) => ipcRenderer.invoke('db:get-recibo', safeStr(reciboId, 100)),
  marcarReciboEntregue: (payload) => ipcRenderer.invoke('db:marcar-recibo-entregue', {
    reciboId: safeStr(payload?.reciboId, 100),
    operadorNome: safeStr(payload?.operadorNome, 100),
    operadorEmail: safeStr(payload?.operadorEmail, 200),
    observacao: safeStr(payload?.observacao, 1000),
    pdfHash: safeStr(payload?.pdfHash, 100),
  }),
  estornarRecibo: (payload) => ipcRenderer.invoke('db:estornar-recibo', {
    reciboId: safeStr(payload?.reciboId, 100),
    operadorNome: safeStr(payload?.operadorNome, 100),
    operadorEmail: safeStr(payload?.operadorEmail, 200),
    justificativa: safeStr(payload?.justificativa, 1000),
  }),
  marcarReciboWhatsapp: (payload) => ipcRenderer.invoke('db:marcar-recibo-whatsapp', {
    reciboId: safeStr(payload?.reciboId, 100),
    sucesso: !!payload?.sucesso,
    erro: safeStr(payload?.erro, 500),
  }),

  // Cursores locais de sincronização
  getDelta: (sinceTimestamp) => ipcRenderer.invoke('db:get-delta', sinceTimestamp),
  clearSyncLog: () => ipcRenderer.invoke('db:clear-sync-log'),
  getLastSync: () => ipcRenderer.invoke('db:get-last-sync'),
  setLastSync: (ts) => ipcRenderer.invoke('db:set-last-sync', safeStr(ts, 30)),

  // Observabilidade e integridade (semi-autonomia)
  getPersistenceQueueStatus: () => ipcRenderer.invoke('db:get-persistence-queue-status'),
  getOperationalHealth: () => ipcRenderer.invoke('db:get-operational-health'),
  runIntegritySupervisor: () => ipcRenderer.invoke('db:run-integrity-supervisor'),
  runRetention: (transacoesDays, auditDays) => ipcRenderer.invoke('db:run-retention', {
    transacoesDays: Math.max(30, Math.trunc(safeNum(transacoesDays, 365))),
    auditDays: Math.max(30, Math.trunc(safeNum(auditDays, 365)))
  }),
  getAuditLogs: (query = {}) => ipcRenderer.invoke('db:get-audit-logs', {
    limit: Math.min(500, Math.max(1, Math.trunc(safeNum(query?.limit, 100)))),
    offset: Math.max(0, Math.trunc(safeNum(query?.offset, 0))),
    search: safeStr(query?.search, 200),
    action: safeStr(query?.action, 100),
    from: safeStr(query?.from, 40),
    to: safeStr(query?.to, 40),
  })
});


