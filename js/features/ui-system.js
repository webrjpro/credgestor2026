// SEÇÃO 22 — SISTEMA DE TEMAS (Dark/Light)
// toggleTheme()  ? alterna entre light/dark
// initTheme()    ? lê preferência do OS / localStorage
// Usa CSS var() + Tailwind class="dark" + data-theme
function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved || 'dark';
    applyTheme(theme);
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    // Sincronizar com Tailwind darkMode: 'class'
    if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
    } else {
        root.classList.remove('dark');
        root.classList.add('light');
    }
    // Forçar repintura
    document.body.style.display = 'none';
    document.body.offsetHeight; // trigger reflow
    document.body.style.display = '';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
    showToast(`Tema ${next === 'dark' ? 'escuro' : 'claro'} ativado!`);
}

// Inicializar tema antes de tudo
initTheme();

// SEÇÃO 23 — NOTIFICAÇÕES INTELIGENTES
// checkNotifications() — varre parcelas próximas a vencer
let notifications = [];

function checkNotifications() {
    notifications = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    state.emprestimos.forEach(emp => {
        if (emp.statusGeral !== 'ativo') return;
        const cliente = getClienteById(emp.clienteId);

        emp.parcelas.forEach(p => {
            if (p.status !== 'pendente') return;
            const venc = parseLocalDate(p.vencimento);
            const diffDays = Math.floor((venc - hoje) / (1000 * 60 * 60 * 24));

            // Vence hoje
            if (diffDays === 0) {
                notifications.push({
                    type: 'warning',
                    icon: 'clock',
                    title: 'Vencimento Hoje!',
                    message: `${cliente?.nome || 'Cliente'} - Parcela #${p.numero} de ${formatMoney(p.valorBase)}`,
                    empId: emp.id,
                    priority: 2
                });
            }
            // Vence amanhã
            else if (diffDays === 1) {
                notifications.push({
                    type: 'info',
                    icon: 'calendar',
                    title: 'Vence Amanhã',
                    message: `${cliente?.nome || 'Cliente'} - Parcela #${p.numero}`,
                    empId: emp.id,
                    priority: 1
                });
            }
            // Atrasado (1-5 dias)
            else if (diffDays < 0 && diffDays >= -5) {
                notifications.push({
                    type: 'alert',
                    icon: 'alert-triangle',
                    title: `Atrasado ${Math.abs(diffDays)} dia(s)`,
                    message: `${cliente?.nome || 'Cliente'} - ${formatMoney(p.valorBase)}`,
                    empId: emp.id,
                    priority: 3
                });
            }
            // Inadimplente (>5 dias)
            else if (diffDays < -5) {
                notifications.push({
                    type: 'critical',
                    icon: 'alert-octagon',
                    title: `INADIMPLENTE (${Math.abs(diffDays)}d)`,
                    message: `${cliente?.nome || 'Cliente'} - URGENTE!`,
                    empId: emp.id,
                    priority: 4
                });
            }
        });
    });

    // Ordenar por prioridade
    notifications.sort((a, b) => b.priority - a.priority);

    // Atualizar badge
    const badge = document.getElementById('notification-count');
    if (badge) {
        if (notifications.length > 0) {
            badge.textContent = notifications.length > 9 ? '9+' : notifications.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function abrirNotificacoes() {
    checkNotifications();

    if (notifications.length === 0) {
        showToast('Nenhuma notificação pendente.');
        return;
    }

    const colors = {
        info: 'bg-blue-50 border-blue-200 text-blue-700',
        warning: 'bg-amber-50 border-amber-200 text-amber-700',
        alert: 'bg-orange-50 border-orange-200 text-orange-700',
        critical: 'bg-red-50 border-red-200 text-red-700 animate-pulse'
    };

    const iconColors = {
        info: 'text-blue-500',
        warning: 'text-amber-500',
        alert: 'text-orange-500',
        critical: 'text-red-500'
    };

    let html = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-end p-4" onclick="this.remove()">
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden scale-in" onclick="event.stopPropagation()">
                <div class="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700">
                    <div>
                        <h3 class="font-bold text-lg flex items-center gap-2">
                            <i data-lucide="bell" class="w-5 h-5 text-emerald-500"></i>
                            Central de Alertas
                        </h3>
                        <p class="text-xs text-slate-500">${notifications.length} notificações pendentes</p>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="overflow-y-auto max-h-[60vh] p-4 space-y-3">
    `;

    notifications.forEach((n, i) => {
        html += `
            <div class="p-4 rounded-xl border-2 ${colors[n.type]} cursor-pointer hover:scale-[1.02] transition-transform" 
                 onclick="openPaymentModal('${encodeURIComponent(String(n.empId || ''))}'); this.closest('.fixed').remove();"
                 style="animation: slideInRight 0.3s ease ${i * 0.05}s both">
                <div class="flex items-start gap-3">
                    <div class="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50">
                        <i data-lucide="${n.icon}" class="w-5 h-5 ${iconColors[n.type]}"></i>
                    </div>
                    <div class="flex-1">
                        <p class="font-bold text-sm">${S(n.title)}</p>
                        <p class="text-xs opacity-80">${S(n.message)}</p>
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 opacity-50"></i>
                </div>
            </div>
        `;
    });

    html += `
                </div>
                <div class="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <button onclick="router('inadimplentes'); this.closest('.fixed').remove();" 
                            class="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors">
                        Ver Todos Inadimplentes
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    refreshIcons();
}

// Limpar sessão ao iniciar o app (sempre exigir login)
localStorage.removeItem(SESSION_KEY);

// Escutar sinal do main process para limpar sessão ao fechar
if (window.electronAPI && window.electronAPI.onClearSession) {
    window.electronAPI.onClearSession(() => {
        localStorage.removeItem(SESSION_KEY);
    });
}

async function showAuthOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;
    document.body.classList.add('auth-locked');
    overlay.style.display = 'flex';

    if (typeof lucide !== 'undefined') lucide.createIcons();

    const loginForm = document.getElementById('auth-form');
    const registerForm = document.getElementById('auth-register-form');
    const recoveryForm = document.getElementById('auth-recovery-form');

    // Ocultar formulários enquanto verifica o status do backend
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (recoveryForm) recoveryForm.classList.add('hidden');

    // Verificar se já existe senha cadastrada (SQLite)
    const creds = await window.db.getCredentials();

    if (creds && creds.error) {
        // Backend ainda está iniciando ou está indisponível
        setAuthMessage('error', 'Iniciando o servidor local... Aguarde alguns segundos.');
        setTimeout(showAuthOverlay, 1500);
        return;
    }

    // Limpar mensagem de erro temporária/carregamento
    setAuthMessage();

    if (!creds) {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (recoveryForm) recoveryForm.classList.add('hidden');
        if (loginForm) loginForm.onsubmit = null;
        if (registerForm) registerForm.onsubmit = handleRegisterSubmit;
    } else {
        if (creds.email) {
            const emailInput = document.getElementById('auth-user');
            if (emailInput) emailInput.value = creds.email;
        }
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (recoveryForm) recoveryForm.classList.add('hidden');
        if (registerForm) registerForm.onsubmit = null;
        if (loginForm) loginForm.onsubmit = handleAuthSubmit;
    }

    refreshIcons();
}

function hideAuthOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('auth-locked');
}

function showAuthLogin() {
    document.getElementById('auth-recovery-form')?.classList.add('hidden');
    document.getElementById('auth-register-form')?.classList.add('hidden');
    const loginForm = document.getElementById('auth-form');
    if (loginForm) {
        loginForm.classList.remove('hidden');
        loginForm.onsubmit = handleAuthSubmit;
    }
    refreshIcons();
}

function showAuthRecovery() {
    document.getElementById('auth-form').classList.add('hidden');
    document.getElementById('auth-register-form').classList.add('hidden');
    const recoveryForm = document.getElementById('auth-recovery-form');
    if (recoveryForm) {
        recoveryForm.classList.remove('hidden');
        recoveryForm.onsubmit = handleAuthRecoverySubmit;
    }
    document.getElementById('auth-recovery-pass')?.focus();
    const fb = document.getElementById('auth-recovery-feedback');
    if (fb) { fb.classList.add('hidden'); fb.textContent = ''; }
    refreshIcons();
}

async function handleAuthRecoverySubmit(e) {
    e.preventDefault();
    const pass = document.getElementById('auth-recovery-pass')?.value?.trim();
    const feedback = document.getElementById('auth-recovery-feedback');
    const btn = document.getElementById('auth-recovery-submit');

    if (!pass) {
        feedback.textContent = 'Digite a senha de recuperação.';
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 dark:bg-red-900/30 text-red-600 border border-red-200 dark:border-red-800';
        feedback.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Verificando...';
    refreshIcons();

    try {
        const result = await window.db.resetWithRecovery(pass);

        if (!result.success) {
            feedback.textContent = 'Senha de recuperação inválida. Verifique a Senha Master (8 caracteres) ou Senha Desenvolvedor (11 caracteres).';
            feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 dark:bg-red-900/30 text-red-600 border border-red-200 dark:border-red-800';
            feedback.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i> Verificar e Liberar Acesso';
            refreshIcons();
            return;
        }

        const level = result.level === 'developer' ? 'Desenvolvedor' : 'Master';
        feedback.textContent = `Acesso liberado via Senha ${level}. Redirecionando para novo cadastro...`;
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border border-emerald-200 dark:border-emerald-800';
        feedback.classList.remove('hidden');

        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem('gestorNome');

        setTimeout(() => location.reload(), 2000);
    } catch (err) {
        feedback.textContent = 'Erro: ' + err.message;
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200';
        feedback.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i> Verificar e Liberar Acesso';
        refreshIcons();
    }
}

function setAuthMessage(type, msg) {
    const err = document.getElementById('auth-error');
    const ok = document.getElementById('auth-success');
    if (!err || !ok) return;
    err.style.display = 'none';
    ok.style.display = 'none';
    if (type === 'error' && msg) {
        err.querySelector('span').textContent = msg;
        err.style.display = 'flex';
    } else if (type === 'ok' && msg) {
        ok.querySelector('span').textContent = msg;
        ok.style.display = 'flex';
    }
}

function storeAdminSession(authResult) {
    if (!authResult || !authResult.accessToken) return;
    const user = authResult.user || {};
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';

    if (!isAdmin) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        return;
    }

    localStorage.setItem('adminToken', authResult.accessToken);
    localStorage.setItem('adminUser', JSON.stringify(user));

    try {
        if (typeof _adminToken !== 'undefined') _adminToken = authResult.accessToken;
        if (typeof _adminUser !== 'undefined') _adminUser = user;
    } catch (error) {
        console.warn('Falha ao sincronizar sessão admin em memória:', error.message);
    }
}

async function loginGestor(usuario, senha) {
    try {
        const result = await window.db.login(usuario, senha);
        if (result && result.success) {
            storeAdminSession(result);
            if (result.nome) localStorage.setItem('gestorNome', result.nome);
            return true;
        }
    } catch (e) {
        console.warn('Erro na autenticação local:', e);
    }
    return false;
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    const nome = document.getElementById('reg-nome')?.value?.trim() || '';
    const email = document.getElementById('reg-email')?.value?.trim() || '';
    const senha = document.getElementById('reg-pass')?.value || '';
    const confirmar = document.getElementById('reg-pass-confirm')?.value || '';

    if (!nome || nome.length < 2) {
        setAuthMessage('error', 'Informe seu nome (mínimo 2 caracteres).');
        return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setAuthMessage('error', 'Informe um e-mail válido (ex: nome@dominio.com).');
        return;
    }
    if (senha.length < 6) {
        setAuthMessage('error', 'A senha deve ter pelo menos 6 caracteres.');
        return;
    }
    if (senha !== confirmar) {
        setAuthMessage('error', 'As senhas não coincidem.');
        return;
    }

    const btn = document.getElementById('auth-register-submit');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Cadastrando...';
    refreshIcons();

    let result = null;
    try {
        result = await window.db.register(nome, email, senha);
        if (!result || !result.success) {
            const rawError = String(result?.error || '');
            const backendStarting = /backend local|fetch failed|ECONNREFUSED|sem resposta|indisponivel|indisponível/i.test(rawError);
            console.error('Registro falhou:', result);
            setAuthMessage(
                'error',
                backendStarting
                    ? 'Backend local ainda está iniciando. Aguarde alguns segundos e tente novamente.'
                    : `Erro ao salvar credenciais${rawError ? ` (${rawError})` : ''}. Tente novamente.`
            );
            btn.disabled = false;
            btn.innerHTML = 'Cadastrar';
            return;
        }
    } catch (err) {
        console.warn('Erro ao registrar:', err);
        setAuthMessage('error', 'Erro inesperado ao cadastrar. Tente novamente.');
        btn.disabled = false;
        btn.innerHTML = 'Cadastrar';
        return;
    }

    storeAdminSession(result);
    localStorage.setItem('gestorNome', nome);

    setAuthMessage('ok', 'Conta criada. Redirecionando...');
    localStorage.setItem(SESSION_KEY, 'ok');

    setTimeout(() => {
        hideAuthOverlay();
        updateGestorNameDisplay();
        bootstrapApp();
    }, 1200);
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('auth-submit');
    const user = (document.getElementById('auth-user')?.value || '').trim();
    const pass = (document.getElementById('auth-pass')?.value || '').trim();
    if (!user || !pass) return;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Autenticando...';
    refreshIcons();
    setAuthMessage();
    try {
        const ok = await loginGestor(user, pass);
        if (!ok) {
            setAuthMessage('error', 'Credenciais inválidas. Verifique e-mail e senha.');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> Acessar Sistema';
            refreshIcons();
            return;
        }
        setAuthMessage('ok', 'Autenticado. Abrindo sistema...');
        localStorage.setItem(SESSION_KEY, 'ok');
        await loadGestorName();

        setTimeout(() => {
            hideAuthOverlay();
            updateGestorNameDisplay();
            bootstrapApp();
        }, 800);
    } catch (err) {
        console.error('Erro auth', err);
        setAuthMessage('error', 'Erro inesperado ao autenticar.');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> Acessar Sistema';
        refreshIcons();
    }
}

// -- Estatísticas do banco de dados (Aba Segurança) --
async function loadDbStats() {
    try {
        const stats = await window.db.getStats();
        const area = document.getElementById('db-stats-area');
        if (!area) return;
        area.innerHTML = `
            <p>Clientes: <strong>${(stats.clientes || 0).toLocaleString()}</strong></p>
            <p>Empréstimos: <strong>${(stats.emprestimos || 0).toLocaleString()}</strong> (${stats.emprestimosAtivos || 0} ativos)</p>
            <p>Transações: <strong>${(stats.transacoes || 0).toLocaleString()}</strong></p>
            <p>Tamanho do banco: <strong>${((stats.dbSize || 0) / 1024 / 1024).toFixed(2)} MB</strong></p>
            <p>Caminho: <span class="text-emerald-500">${S(stats.dbPath) || 'N/A'}</span></p>
        `;
        area.classList.remove('hidden');
    } catch (e) {
        console.error('Erro ao carregar stats:', e);
    }
}

// SEÇÃO 26 — ATALHOS DE TECLADO (Keyboard Shortcuts)
// Ctrl+N ? Novo Empréstimo
// Ctrl+D ? Dashboard
// Ctrl+K ? Foco na busca de clientes
// Esc    ? Fechar modal/notificação aberta
// F5     ? Atualizar interface (sem recarregar página)
document.addEventListener('keydown', function (e) {
    // Ignorar se estiver em input/textarea/select
    const tag = document.activeElement?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const isAuthVisible = document.getElementById('auth-overlay')?.style.display !== 'none';

    // Esc: Fechar modal ou notificação
    if (e.key === 'Escape') {
        // Fechar painel de notificações
        const notifPanel = document.querySelector('.fixed.inset-0 .scale-in');
        if (notifPanel) {
            notifPanel.closest('.fixed').remove();
            return;
        }
        // Fechar qualquer dialog aberto
        const openDialogs = document.querySelectorAll('dialog[open]');
        if (openDialogs.length > 0) {
            openDialogs[openDialogs.length - 1].close();
            return;
        }
    }

    // Não processar atalhos durante login ou em inputs (exceto Esc)
    if (isAuthVisible || isInput) return;

    // Ctrl+N ? Novo Empréstimo
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openLoanModal();
        return;
    }

    // Ctrl+D ? Dashboard
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        router('dashboard');
        return;
    }

    // Ctrl+K ? Pesquisar clientes
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        router('clientes');
        // Foco no campo de busca
        requestAnimationFrame(() => {
            const searchInput = document.querySelector('#app-content input[type="text"]');
            if (searchInput) searchInput.focus();
        });
        return;
    }

    // F5 ? Atualizar interface
    if (e.key === 'F5' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (typeof updateUI === 'function') updateUI();
        showToast('Interface atualizada!', 'info');
        return;
    }
});

// SEÇÃO 27 — ANIMATED NUMBER COUNTER
// animateNumber(element, targetValue, duration, formatter)
// Usado nos cards do dashboard para animar valores monetários.
function animateNumber(el, target, duration = 800, formatter = null) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    const defaultFormatter = (v) => formatMoney(v);
    const fmt = formatter || defaultFormatter;

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (target - start) * eased;
        el.textContent = fmt(current);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// SEÇÃO 28 — CONFIRMAÇÕES INTELIGENTES
// confirmAction(message, onConfirm, options)
// Substitui alerts nativos por um modal premium inline.
function confirmAction(message, onConfirm, options = {}) {
    const { danger = false, confirmText = 'Confirmar', cancelText = 'Cancelar' } = options;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4';
    overlay.style.animation = 'fadeIn 0.2s ease';

    const gradientClass = danger
        ? 'from-red-600 to-rose-600 shadow-red-500/25'
        : 'from-emerald-600 to-teal-600 shadow-emerald-500/25';

    overlay.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 scale-in border border-slate-200 dark:border-slate-700">
            <div class="flex items-start gap-3 mb-5">
                <div class="p-2 rounded-xl ${danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'} flex-shrink-0">
                    <i data-lucide="${danger ? 'alert-triangle' : 'help-circle'}" class="w-5 h-5 ${danger ? 'text-red-600' : 'text-emerald-600'}"></i>
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 dark:text-slate-200 text-sm">${danger ? 'Confirmação Necessária' : 'Confirmar Ação'}</h4>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${message}</p>
                </div>
            </div>
            <div class="flex gap-3">
                <button class="flex-1 py-2.5 px-4 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors" data-action="cancel">
                    ${cancelText}
                </button>
                <button class="flex-1 py-2.5 px-4 text-sm font-bold text-white bg-gradient-to-r ${gradientClass} rounded-xl shadow-lg transition-all hover:-translate-y-0.5" data-action="confirm">
                    ${confirmText}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Focus trap + auto-focus confirm
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    confirmBtn.focus();

    function close() {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
    }

    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', () => { close(); onConfirm(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

