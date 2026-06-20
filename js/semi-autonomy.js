/**
 * Camada Semi-Autonoma:
 * - Motor de tarefas automatizadas com janelas e prioridades
 * - Fila de sugestoes com aprovacao humana
 * - Painel de saude operacional no dashboard
 */
(function () {
    const RUNTIME_KEY = 'cgx_semi_autonomy_runtime_v1';
    const APPROVALS_KEY = 'cgx_semi_autonomy_approvals_v1';
    const MAX_APPROVAL_HISTORY = 400;
    const DEFAULT_INATIVIDADE_MESES = 2;
    const DEFAULT_INATIVIDADE_MENSAGEM = 'Ola {nome}, sentimos sua falta! Faz {meses} meses desde seu ultimo emprestimo. Se precisar, conte com a gente. - {empresa}';

    let started = false;
    let loopTimer = null;
    let runtime = readJson(RUNTIME_KEY, {});
    let approvals = readJson(APPROVALS_KEY, []);

    function nowIso() {
        return new Date().toISOString();
    }

    function todayISODate() {
        return new Date().toISOString().slice(0, 10);
    }

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            console.warn('[semi-autonomy] JSON persistido invalido:', error.message);
            return fallback;
        }
    }

    function writeJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn('[semi-autonomy] Falha ao salvar runtime:', error.message);
        }
    }

    function saveRuntime() {
        writeJson(RUNTIME_KEY, runtime);
    }

    function saveApprovals() {
        if (approvals.length > MAX_APPROVAL_HISTORY) {
            approvals = approvals.slice(approvals.length - MAX_APPROVAL_HISTORY);
        }
        writeJson(APPROVALS_KEY, approvals);
    }

    function sanitizeHtml(str) {
        if (typeof window.S === 'function') return window.S(str);
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    function parseClockToMinutes(clock) {
        const parts = String(clock || '').split(':');
        if (parts.length !== 2) return 0;
        const h = Number(parts[0]);
        const m = Number(parts[1]);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
        return (h * 60) + m;
    }

    function isWithinWindow(windowStart, windowEnd, when) {
        const date = when || new Date();
        const minuteOfDay = (date.getHours() * 60) + date.getMinutes();
        const start = parseClockToMinutes(windowStart);
        const end = parseClockToMinutes(windowEnd);
        if (start <= end) {
            return minuteOfDay >= start && minuteOfDay <= end;
        }
        return minuteOfDay >= start || minuteOfDay <= end;
    }

    function normalizePhone(telefone) {
        const number = String(telefone || '').replace(/\D/g, '');
        if (!number) return '';
        return number.length <= 11 ? `55${number}` : number;
    }

    function parseAnyDate(value) {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
    }

    function openWhatsAppMessage(telefone, mensagem) {
        return {
            success: false,
            offline: true,
            telefone: normalizePhone(telefone),
            mensagem: String(mensagem || ''),
            error: 'Modo offline: WhatsApp removido.'
        };
    }

    function getInatividadeConfig() {
        const cfg = window.state?.config || {};
        const ativoRaw = String(cfg.inatividadeAlertaAtivo ?? '1').toLowerCase();
        const ativo = !(ativoRaw === '0' || ativoRaw === 'false' || ativoRaw === 'off');
        const meses = Math.min(24, Math.max(1, Number.parseInt(cfg.inatividadeAlertaMeses ?? DEFAULT_INATIVIDADE_MESES, 10) || DEFAULT_INATIVIDADE_MESES));
        const template = String(cfg.inatividadeMensagem || DEFAULT_INATIVIDADE_MENSAGEM).trim() || DEFAULT_INATIVIDADE_MENSAGEM;
        const empresa = String(cfg.empresaNome || 'CredGestor').trim() || 'CredGestor';
        return { ativo, meses, template, empresa };
    }

    function getRetentionConfig() {
        const cfg = window.state?.config || {};
        const ativoRaw = String(cfg.retentionAtivo ?? '1').toLowerCase();
        const ativo = !(ativoRaw === '0' || ativoRaw === 'false' || ativoRaw === 'off');
        const transacoesDays = Math.min(3650, Math.max(30, Number.parseInt(cfg.retentionTransacoesDias ?? '365', 10) || 365));
        const auditDays = Math.min(3650, Math.max(30, Number.parseInt(cfg.retentionAuditDias ?? '365', 10) || 365));
        return { ativo, transacoesDays, auditDays };
    }

    function getLastLoanDateForClient(clienteId) {
        const emps = Array.isArray(window.state?.emprestimos) ? window.state.emprestimos : [];
        let latest = null;
        for (const emp of emps) {
            if (emp.clienteId !== clienteId) continue;
            const candidate =
                parseAnyDate(emp.data) ||
                parseAnyDate(emp.dataInicio) ||
                parseAnyDate(emp.createdAt) ||
                parseAnyDate(emp.created_at);
            if (!candidate) continue;
            if (!latest || candidate > latest) latest = candidate;
        }
        return latest;
    }

    function buildInatividadeMensagem(template, payload) {
        const map = {
            '{nome}': payload.nome || 'Cliente',
            '{meses}': String(payload.meses || DEFAULT_INATIVIDADE_MESES),
            '{empresa}': payload.empresa || 'CredGestor',
            '{ultimo_emprestimo}': payload.ultimoEmprestimo || '-',
            '{telefone}': payload.telefone || ''
        };
        let out = String(template || DEFAULT_INATIVIDADE_MENSAGEM);
        Object.keys(map).forEach((token) => {
            out = out.split(token).join(String(map[token]));
        });
        return out;
    }

    function taskState(taskId) {
        runtime.tasks = runtime.tasks || {};
        runtime.tasks[taskId] = runtime.tasks[taskId] || {};
        return runtime.tasks[taskId];
    }

    function shouldRunTask(task, nowTs) {
        const state = taskState(task.id);
        const lastRunAt = state.lastRunAt ? new Date(state.lastRunAt).getTime() : 0;
        const due = (nowTs - lastRunAt) >= task.intervalMs;
        const withinWindow = isWithinWindow(task.windowStart, task.windowEnd, new Date(nowTs));
        return due && withinWindow && !state.running;
    }

    async function runTask(task) {
        const state = taskState(task.id);
        state.running = true;
        state.lastStartedAt = nowIso();
        saveRuntime();

        const startedAt = Date.now();
        try {
            const result = await task.run();
            state.lastStatus = 'ok';
            state.lastError = null;
            state.lastResult = (result && typeof result === 'object') ? result : { ok: true };
        } catch (err) {
            state.lastStatus = 'error';
            state.lastError = err?.message || String(err);
            state.lastResult = { ok: false, error: state.lastError };
            runtime.lastAutomationError = { taskId: task.id, at: nowIso(), error: state.lastError };
        } finally {
            state.running = false;
            state.lastRunAt = nowIso();
            state.lastDurationMs = Date.now() - startedAt;
            saveRuntime();
        }
    }

    function getCollectionsSnapshot() {
        return [];
    }

    function getLowScoreSuggestions() {
        const result = [];
        const clientes = Array.isArray(window.state?.clientes) ? window.state.clientes : [];
        for (const c of clientes) {
            const score = Number(c.scoreCredito || 0);
            if (c.blacklist === true) continue;
            if (score > 200) continue;
            result.push({
                id: `blacklist:${c.id}`,
                type: 'SUGERIR_BLOQUEIO',
                title: `Bloquear ${c.nome}`,
                reason: `Score de credito baixo (${score})`,
                payload: { clienteId: c.id }
            });
        }
        return result;
    }

    function getInatividadeSuggestions() {
        return [];
    }

    function generateSuggestions() {
        const existingIds = new Set(approvals.map((a) => a.id));
        const incoming = [...getCollectionsSnapshot(), ...getLowScoreSuggestions(), ...getInatividadeSuggestions()];
        let added = 0;

        for (const item of incoming) {
            if (existingIds.has(item.id)) continue;
            approvals.push({
                id: item.id,
                type: item.type,
                title: item.title,
                reason: item.reason,
                payload: item.payload,
                status: 'pending',
                createdAt: nowIso(),
                approvedAt: null,
                executedAt: null,
                rejectedAt: null
            });
            existingIds.add(item.id);
            added += 1;
        }

        if (added > 0) {
            saveApprovals();
        }
        return added;
    }

    function getPendingApprovals() {
        return approvals.filter((a) => a.status === 'pending');
    }

    async function executeApproval(approval) {
        if (approval.type === 'COBRANCA_WHATSAPP') {
            return { success: false, offline: true, error: 'Modo offline: WhatsApp removido.' };
        }

        if (approval.type === 'SUGERIR_BLOQUEIO') {
            const clienteId = approval.payload?.clienteId;
            const clientes = Array.isArray(window.state?.clientes) ? window.state.clientes : [];
            const cliente = clientes.find((c) => c.id === clienteId);
            if (!cliente) throw new Error('Cliente nao encontrado para bloqueio');
            if (cliente.blacklist === true) return { success: true, already: true };
            if (typeof window.persistClienteBlacklist === 'function') {
                const result = await window.persistClienteBlacklist(clienteId, true, 'automatico');
                if (!result?.success) throw new Error(result?.error || 'Falha ao bloquear cliente');
            } else if (window.db?.setClienteBlacklist) {
                const result = await window.db.setClienteBlacklist({ clienteId, blocked: true, motivo: 'automatico' });
                if (!result?.success) throw new Error(result?.error || 'Falha ao bloquear cliente');
                if (typeof window.mergeClientePersistido === 'function') window.mergeClientePersistido(result.cliente);
            } else if (window.db?.saveCliente) {
                const next = { ...cliente, blacklist: true, motivoBloqueio: 'automatico' };
                await window.db.saveCliente(next);
            }
            return { success: true };
        }

        if (approval.type === 'REENGAJAR_CLIENTE') {
            return { success: false, offline: true, error: 'Modo offline: WhatsApp removido.' };
        }

        throw new Error(`Tipo de aprovacao nao suportado: ${approval.type}`);
    }

    async function approveAction(id) {
        const item = approvals.find((a) => a.id === id);
        if (!item || item.status !== 'pending') return { success: false, error: 'acao_nao_encontrada' };
        item.status = 'approved';
        item.approvedAt = nowIso();
        saveApprovals();

        try {
            await executeApproval(item);
            item.status = 'executed';
            item.executedAt = nowIso();
            saveApprovals();
            if (typeof window.showToast === 'function') window.showToast('Acao autonoma executada com sucesso.');
            renderHealthPanel();
            return { success: true };
        } catch (err) {
            item.status = 'pending';
            item.lastError = err?.message || String(err);
            saveApprovals();
            return { success: false, error: item.lastError };
        }
    }

    function rejectAction(id) {
        const item = approvals.find((a) => a.id === id);
        if (!item || item.status !== 'pending') return { success: false, error: 'acao_nao_encontrada' };
        item.status = 'rejected';
        item.rejectedAt = nowIso();
        saveApprovals();
        renderHealthPanel();
        return { success: true };
    }

    async function taskBackupLocal() {
        if (!window.electronAPI?.autoBackup || !window.db?.loadState) return { skipped: true, reason: 'api_unavailable' };
        const snapshot = await window.db.loadState();
        const result = await window.electronAPI.autoBackup(snapshot);
        if (result && result.success) {
            runtime.lastValidBackupAt = nowIso();
            saveRuntime();
        }
        return result || { skipped: true };
    }

    async function taskReconcile() {
        if (typeof window.reconcileState !== 'function') return { skipped: true, reason: 'reconcile_unavailable' };
        return await window.reconcileState();
    }

    async function taskRetentionPolicy() {
        if (!window.db?.runRetention) return { skipped: true, reason: 'retention_api_unavailable' };
        const cfg = getRetentionConfig();
        if (!cfg.ativo) return { skipped: true, reason: 'retention_disabled' };

        const result = await window.db.runRetention(cfg.transacoesDays, cfg.auditDays);
        if (result && result.success && (result.transacoesMovidas > 0 || result.auditMovidas > 0)) {
            if (typeof window.showToast === 'function') {
                window.showToast(`Retencao concluida: ${result.transacoesMovidas || 0} transacoes e ${result.auditMovidas || 0} logs arquivados.`);
            }
        }
        return result || { skipped: true };
    }

    async function taskDelinquencyAlert() {
        const pending = getCollectionsSnapshot();
        if (!pending.length) return { success: true, count: 0 };
        const day = todayISODate();
        if (runtime.lastDelinquencyAlertDate === day) return { success: true, count: pending.length, skipped: true };
        runtime.lastDelinquencyAlertDate = day;
        saveRuntime();
        if (typeof window.showToast === 'function') {
            window.showToast(`Alerta autonomo: ${pending.length} cobranca(s) pendente(s) identificada(s).`);
        }
        return { success: true, count: pending.length };
    }

    async function taskPrepareActions() {
        const added = generateSuggestions();
        if (added > 0 && typeof window.showToast === 'function') {
            window.showToast(`${added} acao(oes) autonoma(s) preparada(s) para aprovacao.`);
        }
        return { success: true, added };
    }

    const TASKS = [
        { id: 'backup_local', priority: 100, intervalMs: 30 * 60 * 1000, windowStart: '00:00', windowEnd: '23:59', run: taskBackupLocal },
        { id: 'reconcile_state', priority: 90, intervalMs: 5 * 60 * 1000, windowStart: '00:00', windowEnd: '23:59', run: taskReconcile },
        { id: 'retention_policy', priority: 80, intervalMs: 24 * 60 * 60 * 1000, windowStart: '00:00', windowEnd: '23:59', run: taskRetentionPolicy },
        { id: 'delinquency_alert', priority: 60, intervalMs: 30 * 60 * 1000, windowStart: '08:00', windowEnd: '21:00', run: taskDelinquencyAlert },
        { id: 'prepare_actions', priority: 50, intervalMs: 15 * 60 * 1000, windowStart: '08:00', windowEnd: '21:00', run: taskPrepareActions }
    ];

    async function tick() {
        const now = Date.now();
        const due = TASKS.filter((task) => shouldRunTask(task, now))
            .sort((a, b) => b.priority - a.priority);

        for (const task of due) {
            await runTask(task);
        }

        renderHealthPanel();
    }

    function isDashboardActive() {
        const activeNav = document.querySelector('.sidebar-nav-item.nav-active');
        if (!activeNav) return false;
        return activeNav.id === 'nav-dashboard';
    }

    function formatDateTimeLocal(iso) {
        if (!iso) return 'nunca';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return 'nunca';
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    async function collectHealth() {
        const operational = (window.db?.getOperationalHealth)
            ? await window.db.getOperationalHealth()
            : null;
        const queue = (window.db?.getPersistenceQueueStatus)
            ? await window.db.getPersistenceQueueStatus()
            : null;
        const dbStats = operational?.dbStats || (window.db?.getStats ? await window.db.getStats() : null);

        const memClientes = Array.isArray(window.state?.clientes) ? window.state.clientes.length : 0;
        const memEmprestimos = Array.isArray(window.state?.emprestimos) ? window.state.emprestimos.length : 0;
        const memTransacoes = Array.isArray(window.state?.transacoes) ? window.state.transacoes.length : 0;
        const drift = {
            clientes: Math.abs(memClientes - Number(dbStats?.clientes || 0)),
            emprestimos: Math.abs(memEmprestimos - Number(dbStats?.emprestimos || 0)),
            transacoes: Math.abs(memTransacoes - Number(dbStats?.transacoes || 0))
        };
        const driftTotal = drift.clientes + drift.emprestimos + drift.transacoes;
        const pendingApprovals = getPendingApprovals();

        return {
            operational,
            queue: queue || operational?.queue || { pending: 0, stats: { failed: 0 } },
            dbStats,
            drift,
            driftTotal,
            pendingApprovals
        };
    }

    async function runIntegritySupervisor() {
        if (!window.db?.runIntegritySupervisor) {
            if (typeof window.showToast === 'function') window.showToast('Supervisor de integridade nao disponivel.');
            return null;
        }
        const result = await window.db.runIntegritySupervisor();
        if (typeof window.showToast === 'function') {
            const msg = result?.ok
                ? `Supervisor OK (risco ${result.riskLevel || 'low'})`
                : `Supervisor detectou risco ${result?.riskLevel || 'high'}`;
            window.showToast(msg);
        }
        renderHealthPanel();
        return result;
    }

    async function renderHealthPanel() {
        if (!isDashboardActive()) return;
        const content = document.getElementById('app-content');
        if (!content) return;

        let panel = document.getElementById('semi-autonomy-health');
        if (!panel) {
            panel = document.createElement('section');
            panel.id = 'semi-autonomy-health';
            panel.className = 'mb-6 p-4 rounded-2xl border border-slate-200 bg-white/90 shadow-sm';
            content.prepend(panel);
        }

        panel.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i data-lucide="activity" class="w-4 h-4 text-emerald-500"></i>
                    Saúde Operacional (Semi-autônomo)
                </h3>
                <div class="flex items-center gap-2">
                    <button onclick="executarSupervisorIntegridade()" class="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors">
                        Rodar Supervisor
                    </button>
                    <button onclick="aprovarPrimeiraAcaoAutonoma()" class="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors">
                        Aprovar 1ª ação
                    </button>
                </div>
            </div>
            <div class="text-xs text-slate-500">Atualizando métricas...</div>
        `;

        const health = await collectHealth();
        const risk = sanitizeHtml(health.operational?.riskLevel || 'medium');
        const riskColor = risk === 'high'
            ? 'text-red-600 bg-red-50 border-red-200'
            : (risk === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200');

        const latestBackupAt = health.operational?.latestBackup?.mtime || runtime.lastValidBackupAt || null;
        const syncFailures = Number(runtime.syncFailures || 0);
        const queueFailures = Number(health.queue?.stats?.failed || 0);
        const failedTotal = syncFailures + queueFailures;

        const pendingPreview = health.pendingApprovals.slice(0, 3).map((item) => {
            const approveLabel = item.type === 'REENGAJAR_CLIENTE' ? 'Enviar msg' : 'Aprovar';
            return `
                <div class="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50">
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-700 truncate">${sanitizeHtml(item.title)}</p>
                        <p class="text-[11px] text-slate-500 truncate">${sanitizeHtml(item.reason)}</p>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="aprovarAcaoAutonoma('${sanitizeHtml(item.id)}')" class="px-2 py-1 text-[11px] rounded-md bg-emerald-600 text-white font-bold">${approveLabel}</button>
                        <button onclick="rejeitarAcaoAutonoma('${sanitizeHtml(item.id)}')" class="px-2 py-1 text-[11px] rounded-md bg-slate-300 text-slate-700 font-bold">Rejeitar</button>
                    </div>
                </div>
            `;
        }).join('');

        panel.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i data-lucide="activity" class="w-4 h-4 text-emerald-500"></i>
                    Saúde Operacional (Semi-autônomo)
                </h3>
                <div class="flex items-center gap-2">
                    <button onclick="executarSupervisorIntegridade()" class="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors">
                        Rodar Supervisor
                    </button>
                    <button onclick="aprovarPrimeiraAcaoAutonoma()" class="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors">
                        Aprovar 1ª ação
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs mb-3">
                <div class="p-2 rounded-lg border border-slate-200 bg-slate-50">
                    <p class="text-slate-500 uppercase tracking-wide text-[10px]">Último backup válido</p>
                    <p class="font-bold text-slate-700">${sanitizeHtml(formatDateTimeLocal(latestBackupAt))}</p>
                </div>
                <div class="p-2 rounded-lg border border-slate-200 bg-slate-50">
                    <p class="text-slate-500 uppercase tracking-wide text-[10px]">Falhas de sync</p>
                    <p class="font-bold ${failedTotal > 0 ? 'text-red-600' : 'text-emerald-600'}">${failedTotal}</p>
                </div>
                <div class="p-2 rounded-lg border border-slate-200 bg-slate-50">
                    <p class="text-slate-500 uppercase tracking-wide text-[10px]">Fila de persistência</p>
                    <p class="font-bold text-slate-700">${Number(health.queue?.pending || 0)} pendente(s)</p>
                </div>
                <div class="p-2 rounded-lg border border-slate-200 bg-slate-50">
                    <p class="text-slate-500 uppercase tracking-wide text-[10px]">Drift memória x banco</p>
                    <p class="font-bold ${health.driftTotal > 0 ? 'text-amber-600' : 'text-emerald-600'}">${health.driftTotal}</p>
                </div>
                <div class="p-2 rounded-lg border ${riskColor}">
                    <p class="uppercase tracking-wide text-[10px]">Risco de perda</p>
                    <p class="font-bold">${risk.toUpperCase()}</p>
                </div>
            </div>
            <div class="p-2 rounded-lg border border-slate-200 bg-white">
                <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-bold text-slate-700">Ações autônomas aguardando aprovação</p>
                    <p class="text-xs text-slate-500">${health.pendingApprovals.length} pendente(s)</p>
                </div>
                <div class="space-y-2">
                    ${pendingPreview || '<p class="text-xs text-slate-500">Nenhuma ação pendente.</p>'}
                </div>
            </div>
        `;

        if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function installHooks() {
        if (window.__semiAutonomyHooksInstalled) return;
        window.__semiAutonomyHooksInstalled = true;

        const originalRouter = window.router;
        if (typeof originalRouter === 'function') {
            window.router = function (view) {
                originalRouter(view);
                setTimeout(() => {
                    if (view === 'dashboard') renderHealthPanel();
                }, 0);
            };
        }

        const originalUpdateUI = window.updateUI;
        if (typeof originalUpdateUI === 'function') {
            window.updateUI = function () {
                originalUpdateUI();
                setTimeout(() => {
                    if (isDashboardActive()) renderHealthPanel();
                }, 0);
            };
        }
    }

    function start() {
        if (started) return;
        started = true;
        installHooks();
        tick().catch(() => { });
        loopTimer = setInterval(() => {
            tick().catch(() => { });
        }, 60 * 1000);
    }

    async function approveFirstPendingAction() {
        const pending = getPendingApprovals();
        if (!pending.length) {
            if (typeof window.showToast === 'function') window.showToast('Nenhuma ação pendente para aprovar.');
            return { success: false, error: 'no_pending_actions' };
        }
        return await approveAction(pending[0].id);
    }

    window.aprovarAcaoAutonoma = async function (id) {
        const result = await approveAction(id);
        if (!result.success && typeof window.showToast === 'function') {
            window.showToast(`Falha ao aprovar ação: ${result.error || 'erro desconhecido'}`);
        }
        return result;
    };

    window.rejeitarAcaoAutonoma = function (id) {
        const result = rejectAction(id);
        if (!result.success && typeof window.showToast === 'function') {
            window.showToast(`Falha ao rejeitar ação: ${result.error || 'erro desconhecido'}`);
        }
        return result;
    };

    window.aprovarPrimeiraAcaoAutonoma = function () {
        return approveFirstPendingAction();
    };

    window.executarSupervisorIntegridade = function () {
        return runIntegritySupervisor();
    };

    window.SemiAutonomy = {
        start,
        renderHealthPanel,
        getPendingApprovals,
        approveAction,
        rejectAction,
        runIntegritySupervisor
    };
})();
