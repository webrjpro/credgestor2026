/**
 * +------------------------------------------------------------------+
 *   CREDGESTOR  Motor JavaScript (Renderer)         
 * ------------------------------------------------------------------
 *                                                                   
 *   MAPA DE SEÇÕES (em ordem):                                      
 *   +- SEÇÃO 1 : Modo offline                                     
 *   +- SEÇÃO 2 : Motor SQLite local                               
 *   +- SEÇÃO 3 : Estado Global & Bootstrap                         
 *   +- SEÇÃO 4 : Análise de Risco / AI Score                       
 *   +- SEÇÃO 5 : Backup local                                    
 *   +- SEÇÃO 6 : Utilitrios de Negócio (transações, export)       
 *   +- SEÇÃO 7 : Roteamento SPA                                    
 *   +- SEÇÃO 8 : Helpers Financeiros (datas, status, multas)       
 *   +- SEÇÃO 9 : Gestão de Caixa & Configurações                  
 *   +- SEÇÃO 10: Segurana (alteração/reset de senha)              
 *   +- SEÇÃO 11: Modal de Empréstimo (simulação, criação)          
 *   +- SEÇÃO 12: Dashboard (cards, gráficos Chart.js)              
 *   +- SEÇÃO 13: Views Filtradas (em aberto/inadimplentes/fin.)    
 *   +- SEÇÃO 14: Gestão de Pagamentos (parcelas, quitação)         
 *   +- SEÇÃO 15: View de Clientes (CRUD, importar Excel)           
 *   +- SEÇÃO 16: View Extratos (histórico, PDF, ZIP)               
 *   +- SEÇÃO 17: Calculadora de Juros Compostos                    
 *   +- SEÇÃO 18: Agenda de Cobranas & WhatsApp                    
 *   +- SEÇÃO 19: Central de Relatérios (Excel)                     
 *   +- SEÇÃO 20: Utilitrios Gerais (toast, filtro, formatDate)    
 *   +- SEÇÃO 21: Autenticação local                               
 *   +- SEÇÃO 22: Sistema de Temas (dark/light)                     
 *   +- SEÇÃO 23: Sistema de Notificações                           
 *   +- SEÇÃO 24: Auth Overlay (login/registro)                     
 *                                                                   
 * +------------------------------------------------------------------+
 */

// ──────────────────────────────────────────────────────────────
// SEÇÃO 0 · UTILITÁRIOS DE SEGURANÇA (XSS-safe)
// ──────────────────────────────────────────────────────────────
// Toda string vinda do usuário (cliente.nome, obs, telefone, descricao,
// import XLSX, etc.) DEVE passar por escapeHtml antes de ser interpolada
// em template literals que vão para innerHTML. Sem isso, um valor como
// `<img src=x onerror="alert(1)">` em cliente.nome dispara JS no renderer.
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// Disponível também como window.escapeHtml para os outros arquivos JS.
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
}

// SEÇÃO 1  MODO OFFLINE
async function ensureOfflineOnly() {
    alert('Modo offline ativo: sincronizacao externa foi removida.');
    return false;
}
// SEÇÃO 2  MOTOR SQLite LOCAL
// O banco SQLite roda no backend local via better-sqlite3.
// Comunicação: renderer -> preload (window.db) -> main.js -> API local -> database.js
// Capacidade: 200.000+ clientes, 5.000 movimentos/dia (saves incrementais).
// Saves individuais: O(1) por operação  apenas o registro alterado  persistido.

// SEÇÃO 3  ESTADO GLOBAL & BOOTSTRAP
// O objeto `state`  a NICA fonte de verdade do app.
// Contm: clientes, empréstimos, transações, config e caixa.
//  carregado do SQLite em loadData() e salvo em saveData().
const DEFAULT_INATIVIDADE_ALERTA_MESES = '2';
const DEFAULT_INATIVIDADE_MENSAGEM = 'Ola {nome}, sentimos sua falta! Faz {meses} meses desde seu ultimo emprestimo. Se precisar, conte com a gente. - {empresa}';
const DEFAULT_LOAN_TEMPLATE_CONFIG = {
    defaultTaxaAvulso20: '20',
    defaultTaxaAvulso30: '30',
    defaultTaxaParcelado: '0',
    defaultTaxaCartao: '0',
    defaultTaxaOutros: '0',
    defaultMultaDiaria: '1',
    defaultMultaFixa: '0',
    defaultCarenciaDias: '5',
    defaultPrazoAvulso: '30',
    defaultQtdParcelas: '2',
    printReceiptFormat: 'a4',
    backupFisicoAtivo: '1',
    backupFisicoDiretorio: '',
    backupFisicoRetencao: '20'
};

function getDefaultConfig() {
    return {
        empresaNome: '',
        empresaTelefone: '',
        inatividadeAlertaAtivo: '1',
        inatividadeAlertaMeses: DEFAULT_INATIVIDADE_ALERTA_MESES,
        inatividadeMensagem: DEFAULT_INATIVIDADE_MENSAGEM,
        retentionAtivo: '1',
        retentionTransacoesDias: '365',
        retentionAuditDias: '365',
        // Tipos de crédito configuráveis (JSON stringificado). Vazio = usa defaults hardcoded.
        creditTiposLabels: '',
        creditTiposExtras: '[]',
        ...DEFAULT_LOAN_TEMPLATE_CONFIG
    };
}

function getConfigNumber(chave, fallback = 0, min = null, max = null) {
    const raw = state?.config?.[chave];
    let n = Number(raw);
    if (!Number.isFinite(n)) n = Number(fallback);
    if (!Number.isFinite(n)) n = 0;
    if (min !== null) n = Math.max(Number(min), n);
    if (max !== null) n = Math.min(Number(max), n);
    return n;
}

function getLoanTemplateConfig() {
    return {
        taxaAvulso20: getConfigNumber('defaultTaxaAvulso20', 20, 0, 1000),
        taxaAvulso30: getConfigNumber('defaultTaxaAvulso30', 30, 0, 1000),
        taxaParcelado: getConfigNumber('defaultTaxaParcelado', 0, 0, 1000),
        taxaCartao: getConfigNumber('defaultTaxaCartao', 0, 0, 1000),
        taxaOutros: getConfigNumber('defaultTaxaOutros', 0, 0, 1000),
        multaDiaria: getConfigNumber('defaultMultaDiaria', 1, 0, 1000),
        multaFixa: getConfigNumber('defaultMultaFixa', 0, 0, 999999999),
        carenciaDias: Math.round(getConfigNumber('defaultCarenciaDias', 5, 0, 365)),
        prazoAvulso: String(state?.config?.defaultPrazoAvulso || '30') === '20' ? '20' : '30',
        qtdParcelas: Math.max(2, Math.round(getConfigNumber('defaultQtdParcelas', 2, 2, 360)))
    };
}

function getPrintConfig() {
    const format = String(state?.config?.printReceiptFormat || 'a4');
    const normalized = ['a4', 'thermal80', 'thermal58'].includes(format) ? format : 'a4';
    return {
        format: normalized,
        thermal: normalized !== 'a4',
        widthMm: normalized === 'thermal58' ? 58 : 80
    };
}

var state = {
    clientes: [],
    emprestimos: [],
    transacoes: [],
    config: getDefaultConfig(),
    caixa: { saldo: 0, historico: [] },
    arquivoAprovados: [],
    lastSave: null
};
var currentLoanId = null;
var editingCustomerId = null;
var riskChartInstance = null; // Instância do Chart.js

// -- Performance: debounce lucide.createIcons --
var _lucidePending = false;
function refreshIcons() {
    if (_lucidePending) return;
    _lucidePending = true;
    requestAnimationFrame(() => {
        lucide.createIcons();
        _lucidePending = false;
    });
}

// -- Performance: cache de analyzeRisk --
var _riskCache = new Map();
var _riskCacheVersion = 0;
function invalidateRiskCache() { _riskCacheVersion++; _riskCache.clear(); }
function analyzeRiskCached(clienteId) {
    const key = `${clienteId}_${_riskCacheVersion}`;
    if (_riskCache.has(key)) return _riskCache.get(key);
    const result = analyzeRisk(clienteId);
    _riskCache.set(key, result);
    return result;
}

// -- Inicialização (Bootstrap) ------------------------------
// bootstrapApp() ? carrega dados ? renderiza ? inicia relógio
// Chamado após o login ser validado com sucesso.
var appInitialized = false;
const LOAD_STATE_TIMEOUT_MS = 12000;

function withTimeout(promise, timeoutMs, timeoutLabel) {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(timeoutLabel || `Tempo limite excedido (${timeoutMs}ms)`));
        }, timeoutMs);
    });
    return Promise.race([
        Promise.resolve(promise).finally(() => {
            if (timeoutId) clearTimeout(timeoutId);
        }),
        timeoutPromise
    ]);
}

async function bootstrapApp() {
    if (appInitialized) return;
    appInitialized = true;
    const loader = document.getElementById('db-loading');
    if (loader) loader.style.display = 'block';
    try {
        await loadData();
        updateHeaderSaldo();
        router('dashboard');
        refreshIcons();
        const dataInput = document.getElementById('emp-data');
        if (dataInput) dataInput.valueAsDate = new Date();

        // Iniciar relógio
        updateClock();
        setInterval(updateClock, 1000);

        // Verificar notificações e agenda
        checkNotifications();
        updateAgendaBadge();

        // Reconciliar estado com SQLite (auto-heal)
        reconcileState();

        // Inicializar camada semi-autonoma (tarefas, sugestoes, painel de saude)
        if (window.SemiAutonomy && typeof window.SemiAutonomy.start === 'function') {
            try {
                window.SemiAutonomy.start();
            } catch (e) {
                console.warn('[SemiAutonomy] Falha ao iniciar:', e.message);
            }
        }

    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const clockEl = document.getElementById('clock-display');
    if (clockEl) clockEl.textContent = timeStr;
}

function updateAgendaBadge() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let count = 0;

    state.emprestimos.forEach(emp => {
        if (emp.statusGeral !== 'ativo') return;
        emp.parcelas.forEach(p => {
            if (p.status !== 'pendente') return;
            const venc = parseLocalDate(p.vencimento);
            const diffDays = Math.floor((venc - hoje) / (1000 * 60 * 60 * 24));
            if (diffDays <= 3) count++; // Vence em até 3 dias ou atrasado
        });
    });

    const badge = document.getElementById('agenda-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.classList.remove('hidden');
            badge.classList.add('flex');
        } else {
            badge.classList.add('hidden');
        }
    }
}

window.onload = () => {
    // Inicializar ícones Lucide primeiro
    if (typeof lucide !== 'undefined') {
        refreshIcons();
    }
    // No desktop (Electron), window.db e exposto via preload.js.
    // Mantemos o evento 'db-ready' como fallback para inicializacao assincrona.
    if (window.db) {
        showAuthOverlay();
    } else {
        window.addEventListener('db-ready', () => showAuthOverlay());
    }
};

async function loadData() {
    try {
        // Indicador visual de carga — evita sensação de "travado" com base grande.
        // Em 30k+ clientes, loadState pode levar 3-8s; sem feedback o usuário acha que travou.
        const loader = document.getElementById('db-loading');
        if (loader) {
            loader.style.display = 'block';
            loader.setAttribute('data-phase', 'loading');
        }
        try {
            const stats = await window.db.getStats().catch(() => null);
            if (stats && stats.clientes > 5000 && typeof showToast === 'function') {
                showToast(`Carregando ${stats.clientes.toLocaleString('pt-BR')} clientes do banco local...`, 'info');
            }
        } catch (error) {
            console.warn('[core] Falha ao carregar estatisticas iniciais:', error.message);
        }

        // Carregar estado do SQLite (SSD local)
        const saved = await withTimeout(
            window.db.loadState(),
            LOAD_STATE_TIMEOUT_MS,
            `Timeout ao carregar dados locais (${Math.round(LOAD_STATE_TIMEOUT_MS / 1000)}s)`
        );
        
        if (saved && (saved.clientes?.length || saved.emprestimos?.length || saved.transacoes?.length || saved.arquivoAprovados?.length || (saved.caixa && saved.caixa.saldo !== 0))) {
            state = saved;
        } else {
            state = { clientes: [], emprestimos: [], transacoes: [], arquivoAprovados: [], config: getDefaultConfig(), caixa: { saldo: 0, historico: [] }, lastSave: null };
        }

        // Normalização de Dados (Schema Evolution)
        if (!state.transacoes) state.transacoes = [];
        if (state.lastSave === undefined) state.lastSave = null;
        if (!state.clientes) state.clientes = [];
        if (!state.emprestimos) state.emprestimos = [];
        state.config = Object.assign(getDefaultConfig(), state.config || {});
        if (!state.config.empresaNome) state.config.empresaNome = 'CredGestor';
        if (!state.caixa) state.caixa = { saldo: 0, historico: [] };
        if (!Array.isArray(state.arquivoAprovados)) state.arquivoAprovados = [];

        state.clientes.forEach(c => {
            if (c.dataNascimento === undefined) c.dataNascimento = '';
            if (c.renda === undefined) c.renda = 0;
            if (c.percentualLimiteRenda === undefined) c.percentualLimiteRenda = (1 / 3);
            if (c.limite === undefined) c.limite = 2000;
            if (c.limiteParcelado === undefined) c.limiteParcelado = c.limite;
            if (c.limiteCartao === undefined) c.limiteCartao = c.limite;
            if (c.tipoLimite === undefined) c.tipoLimite = 'total'; 
            if (c.cpf === undefined) c.cpf = '';
            if (c.obs === undefined) c.obs = '';
            if (c.diaVencimento === undefined) c.diaVencimento = '';
            if (c.dataCadastro === undefined) c.dataCadastro = new Date().toISOString().split('T')[0];
            if (c.status === undefined) c.status = 'ativo';
            if (c.scoreManual === undefined) c.scoreManual = null;
            if (c.scoreGestor === undefined) c.scoreGestor = null;
            if (c.scoreCredito === undefined) c.scoreCredito = 500;
            if (c.pagamentosEmDia === undefined) c.pagamentosEmDia = 0;
            if (c.blacklist === undefined) c.blacklist = false;
            if (c.motivoBloqueio === undefined) c.motivoBloqueio = '';
            if (!Array.isArray(c.contatos)) c.contatos = [];
        });

    } catch (err) {
        console.error("Erro crítico ao carregar banco de dados:", err);
        state = { clientes: [], emprestimos: [], transacoes: [], arquivoAprovados: [], config: getDefaultConfig(), caixa: { saldo: 0, historico: [] }, lastSave: null };
        if (typeof showToast === 'function') {
            showToast("Falha ao carregar banco local. Sistema iniciado em modo seguro.", "warning");
        } else {
            alert("Erro ao iniciar banco de dados. Verifique o console.");
        }
    } finally {
        const loader = document.getElementById('db-loading');
        if (loader) loader.style.display = 'none';
    }
}

async function saveData() {
    const loader = document.getElementById('db-loading');
    if(loader) loader.style.display = 'block';
    // Aviso cirúrgico para bases grandes: saveState é full-sync. Em 30k+ clientes
    // pode travar UI por 2-4s. Código que usa persistCliente/persistEmprestimo
    // individuais não tem esse problema — saveData deve ser usado só em bulk import/restore.
    const tamState = (state?.clientes?.length || 0) + (state?.emprestimos?.length || 0);
    if (tamState > 20000) {
        console.warn(`[saveData] State grande (${tamState} registros). Prefira persistCliente/persistEmprestimo.`);
    }
    try {
        const result = await window.db.saveState(state);
        if (!result || result.success !== true) {
            throw new Error(result?.error || 'Falha ao salvar estado no banco local');
        }
    } catch (e) {
        console.error("Erro ao salvar no SQLite", e);
        showToast("ERRO AO SALVAR DADOS!");
    } finally {
        if(loader) loader.style.display = 'none';
    }
    updateUI();
}

async function persistCliente(cliente) {
    try {
        const result = await window.db.saveCliente(cliente);
        if (!result || result.success !== true) {
            throw new Error(result?.error || 'Falha ao persistir cliente');
        }
        return { success: true, id: result?.id || cliente?.id || null, cliente: result?.cliente || null };
    } catch(e) {
        console.error('Erro ao persistir cliente:', e);
        const raw = String(e?.message || 'Falha ao persistir cliente');
        const low = raw.toLowerCase();
        if (low.includes('matricula já cadastrada') || low.includes('matricula ja cadastrada')) {
            showToast('Matrícula já cadastrada. Informe outra matrícula.', 'error');
        } else {
            showToast('Erro ao salvar cliente: ' + raw, 'error');
        }
        return { success: false, error: raw };
    }
}

function mergeClientePersistido(cliente) {
    if (!cliente?.id) return null;
    if (!Array.isArray(state.clientes)) state.clientes = [];
    const idx = state.clientes.findIndex(c => c.id === cliente.id);
    if (idx !== -1) {
        state.clientes[idx] = { ...state.clientes[idx], ...cliente };
        return state.clientes[idx];
    }
    state.clientes.push(cliente);
    return cliente;
}

async function persistClienteBlacklist(clienteId, blocked, motivo = 'manual') {
    try {
        const result = await window.db.setClienteBlacklist({
            clienteId,
            blocked: blocked === true,
            motivo: motivo || 'manual',
        });
        if (!result || result.success !== true) {
            throw new Error(result?.error || 'Falha ao alterar Lista de Bloqueados');
        }
        const cliente = mergeClientePersistido(result.cliente);
        return { success: true, cliente };
    } catch (e) {
        console.error('Erro ao alterar Lista de Bloqueados:', e);
        const raw = e?.message || 'Falha ao alterar Lista de Bloqueados';
        showToast('Erro ao alterar Lista de Bloqueados: ' + raw, 'error');
        return { success: false, error: raw };
    }
}

async function persistDeleteCliente(id) {
    try {
        const result = await window.db.deleteCliente(id);
        if (!result || result.success !== true) {
            throw new Error(result?.error || result?.reason || 'Falha ao deletar cliente');
        }
        syncCaixaFromPersistenceResult(result);
        return { success: true };
    } catch(e) {
        console.error('Erro ao deletar cliente:', e);
        showToast('ERRO AO DELETAR CLIENTE!', 'error');
        return { success: false, error: e?.message || 'Falha ao deletar cliente' };
    }
}

function syncCaixaFromPersistenceResult(result) {
    const caixa = result?.caixa;
    if (!caixa) return;
    if (!state.caixa) state.caixa = { saldo: 0, historico: [] };
    if (!Array.isArray(state.caixa.historico)) state.caixa.historico = [];

    const saldo = Number(caixa.saldo);
    if (Number.isFinite(saldo)) state.caixa.saldo = saldo;

    const historico = caixa.historico;
    if (historico && historico.id !== undefined) {
        const exists = state.caixa.historico.some(item => String(item.id) === String(historico.id));
        if (!exists) state.caixa.historico.push(historico);
    }
}

async function persistEmprestimo(emp) {
    try {
        const result = await window.db.saveEmprestimo(emp);
        if (!result || result.success !== true) {
            throw new Error(result?.error || 'Falha ao persistir emprestimo');
        }
        syncCaixaFromPersistenceResult(result);
        return { success: true, id: result?.id || emp?.id || null, caixa: result.caixa || null, emprestimo: result.emprestimo || null };
    } catch(e) {
        console.error('Erro ao persistir empréstimo:', e);
        showToast('ERRO AO SALVAR EMPRÉSTIMO!', 'error');
        return { success: false, error: e?.message || 'Falha ao persistir empréstimo' };
    }
}

function normalizeCaixaHistoricoEntry(historicoEntry) {
    if (!historicoEntry) return null;
    const saldoPosterior = Number(state.caixa?.saldo || 0);
    const valor = Number(historicoEntry.valor || 0);
    const tipo = historicoEntry.tipo === 'saida' ? 'saida' : 'entrada';
    const delta = tipo === 'entrada' ? valor : -valor;
    const saldoAnterior = Number.isFinite(Number(historicoEntry.saldoAnterior))
        ? Number(historicoEntry.saldoAnterior)
        : saldoPosterior - delta;

    historicoEntry.tipo = tipo;
    historicoEntry.valor = valor;
    historicoEntry.saldoAnterior = saldoAnterior;
    historicoEntry.saldoPosterior = Number.isFinite(Number(historicoEntry.saldoPosterior))
        ? Number(historicoEntry.saldoPosterior)
        : saldoPosterior;
    return historicoEntry;
}

async function persistCaixa(historicoEntry) {
    try {
        if (!state.caixa) state.caixa = { saldo: 0, historico: [] };
        if (!Array.isArray(state.caixa.historico)) state.caixa.historico = [];
        const historicoNormalizado = normalizeCaixaHistoricoEntry(historicoEntry);
        const saldoAtual = Number(state.caixa.saldo || 0);

        if (historicoNormalizado) {
            const historicoResult = await window.db.addCaixaHistorico(
                historicoNormalizado.tipo, historicoNormalizado.valor,
                historicoNormalizado.descricao || '',
                historicoNormalizado.saldoAnterior || 0,
                historicoNormalizado.saldoPosterior || 0,
                historicoNormalizado.data || new Date().toISOString()
            );
            if (!historicoResult || historicoResult.success !== true) {
                throw new Error(historicoResult?.error || 'Falha ao salvar historico de caixa');
            }
            const saldoPersistido = Number(historicoResult?.historico?.saldoPosterior ?? historicoResult?.historico?.saldo_posterior);
            if (Number.isFinite(saldoPersistido)) state.caixa.saldo = saldoPersistido;
        } else {
            const caixaResult = await window.db.updateCaixa(saldoAtual);
            if (!caixaResult || caixaResult.success !== true) {
                throw new Error(caixaResult?.error || 'Falha ao atualizar caixa');
            }
        }
        return { success: true };
    } catch(e) {
        console.error('Erro ao persistir caixa:', e);
        showToast('ERRO AO SALVAR CAIXA!', 'error');
        return { success: false, error: e?.message || 'Falha ao persistir caixa' };
    }
}

async function persistConfig() {
    try {
        const nomeResult = await window.db.setConfig('empresaNome', state.config.empresaNome || '');
        if (!nomeResult || nomeResult.success !== true) {
            throw new Error(nomeResult?.error || 'Falha ao salvar configuracao empresaNome');
        }
        const telResult = await window.db.setConfig('empresaTelefone', state.config.empresaTelefone || '');
        if (!telResult || telResult.success !== true) {
            throw new Error(telResult?.error || 'Falha ao salvar configuracao empresaTelefone');
        }
        const ativoResult = await window.db.setConfig('inatividadeAlertaAtivo', state.config.inatividadeAlertaAtivo || '1');
        if (!ativoResult || ativoResult.success !== true) {
            throw new Error(ativoResult?.error || 'Falha ao salvar configuracao inatividadeAlertaAtivo');
        }
        const mesesResult = await window.db.setConfig('inatividadeAlertaMeses', state.config.inatividadeAlertaMeses || DEFAULT_INATIVIDADE_ALERTA_MESES);
        if (!mesesResult || mesesResult.success !== true) {
            throw new Error(mesesResult?.error || 'Falha ao salvar configuracao inatividadeAlertaMeses');
        }
        const msgResult = await window.db.setConfig('inatividadeMensagem', state.config.inatividadeMensagem || DEFAULT_INATIVIDADE_MENSAGEM);
        if (!msgResult || msgResult.success !== true) {
            throw new Error(msgResult?.error || 'Falha ao salvar configuracao inatividadeMensagem');
        }
        const retentionAtivoResult = await window.db.setConfig('retentionAtivo', state.config.retentionAtivo || '1');
        if (!retentionAtivoResult || retentionAtivoResult.success !== true) {
            throw new Error(retentionAtivoResult?.error || 'Falha ao salvar configuracao retentionAtivo');
        }
        const retentionTxResult = await window.db.setConfig('retentionTransacoesDias', state.config.retentionTransacoesDias || '365');
        if (!retentionTxResult || retentionTxResult.success !== true) {
            throw new Error(retentionTxResult?.error || 'Falha ao salvar configuracao retentionTransacoesDias');
        }
        const retentionAuditResult = await window.db.setConfig('retentionAuditDias', state.config.retentionAuditDias || '365');
        if (!retentionAuditResult || retentionAuditResult.success !== true) {
            throw new Error(retentionAuditResult?.error || 'Falha ao salvar configuracao retentionAuditDias');
        }
        // ── Tipos de crédito configuráveis ──
        if (state.config.creditTiposLabels !== undefined) {
            const r = await window.db.setConfig('creditTiposLabels', state.config.creditTiposLabels || '');
            if (!r || r.success !== true) throw new Error(r?.error || 'Falha ao salvar creditTiposLabels');
        }
        if (state.config.creditTiposExtras !== undefined) {
            const r = await window.db.setConfig('creditTiposExtras', state.config.creditTiposExtras || '');
            if (!r || r.success !== true) throw new Error(r?.error || 'Falha ao salvar creditTiposExtras');
        }
        const extraConfigKeys = [
            'defaultTaxaAvulso20',
            'defaultTaxaAvulso30',
            'defaultTaxaParcelado',
            'defaultTaxaCartao',
            'defaultTaxaOutros',
            'defaultMultaDiaria',
            'defaultMultaFixa',
            'defaultCarenciaDias',
            'defaultPrazoAvulso',
            'defaultQtdParcelas',
            'printReceiptFormat',
            'backupFisicoAtivo',
            'backupFisicoDiretorio',
            'backupFisicoRetencao'
        ];
        const defaults = getDefaultConfig();
        for (const key of extraConfigKeys) {
            const value = state.config[key] ?? defaults[key] ?? '';
            const r = await window.db.setConfig(key, String(value));
            if (!r || r.success !== true) throw new Error(r?.error || `Falha ao salvar ${key}`);
        }
        return { success: true };
    } catch(e) {
        console.error('Erro ao persistir config:', e);
        showToast('ERRO AO SALVAR CONFIGURAÇÕES!', 'error');
        return { success: false, error: e?.message || 'Falha ao persistir configurações' };
    }
}

async function persistBatchClientes(clientes) {
    try {
        const result = await window.db.saveBatchClientes(clientes);
        if (!result || result.success !== true) {
            throw new Error(result?.error || 'Falha ao persistir lote de clientes');
        }
        return { success: true, count: result?.count || clientes?.length || 0 };
    } catch(e) {
        console.error('Erro ao persistir lote de clientes:', e);
        showToast('ERRO AO IMPORTAR LOTE NO BANCO!', 'error');
        return { success: false, error: e?.message || 'Falha ao persistir lote de clientes' };
    }
}

// RECONCILIAO DE ESTADO (Memória ? SQLite)
// Verifica se os contadores em memória batem com o SQLite.
// Se houver divergncia, recarrega do banco e atualiza a UI.
// Chamado após operações em lote (import, reset).
async function reconcileState() {
    try {
        const stats = await window.db.getStats();
        const memClientes = state.clientes.length;
        const memEmprestimos = state.emprestimos.length;
        const dbClientes = stats.clientes || 0;
        const dbEmprestimos = stats.emprestimos || 0;

        if (memClientes !== dbClientes || memEmprestimos !== dbEmprestimos) {
            console.warn(`[Reconcile] Divergência detectada. Memória: ${memClientes}C/${memEmprestimos}E | SQLite: ${dbClientes}C/${dbEmprestimos}E. Recarregando...`);
            await loadData();
            if (typeof updateUI === 'function') updateUI();
            if (typeof showToast === 'function') {
                showToast(`Atenção: divergência detectada (${memClientes}/${dbClientes} clientes). Tela recarregada pelo banco local.`, 'warning');
            }
            return { reconciled: true, before: { memClientes, memEmprestimos }, after: { dbClientes, dbEmprestimos } };
        }
        return { reconciled: false };
    } catch (e) {
        console.error('[Reconcile] Erro:', e);
        return { reconciled: false, error: e.message };
    }
}




