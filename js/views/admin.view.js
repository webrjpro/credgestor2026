// SEÇÃO: ADMINISTRAO  Gerenciar Usuários

/** Cache da sessão administrativa local. */
var _adminToken = null;
var _adminUser = null;

function isAdminSession() {
    return _adminUser && (_adminUser.role === 'admin' || _adminUser.role === 'superadmin');
}

function clearAdminSession() {
    _adminToken = null;
    _adminUser = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
}

(function _restoreAdminSession() {
    try {
        const savedToken = localStorage.getItem('adminToken');
        const savedUser = localStorage.getItem('adminUser');
        if (savedToken && savedUser) {
            _adminToken = savedToken;
            _adminUser = JSON.parse(savedUser);
            console.log('Sessão admin restaurada do localStorage.');
        }
    } catch (e) {
        console.warn('Erro ao restaurar sessão admin:', e);
    }
})();

/** Roteia operações administrativas pelo IPC local. */
async function _apiFetch(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    let body = {};
    if (options.body) {
        try { body = JSON.parse(options.body); } catch (_) { body = {}; }
    }

    let data = null;
    const listMatch = String(path || '').match(/^\/api\/tenants\/([^/]+)\/users$/);
    const deleteMatch = String(path || '').match(/^\/api\/tenants\/([^/]+)\/users\/(\d+)$/);

    if (method === 'GET' && listMatch) {
        data = await window.db.adminListUsers(decodeURIComponent(listMatch[1]));
    } else if (method === 'POST' && path === '/api/tenants/create-user') {
        data = await window.db.adminCreateUser(body);
    } else if (method === 'DELETE' && deleteMatch) {
        data = await window.db.adminDeleteUser(decodeURIComponent(deleteMatch[1]), Number(deleteMatch[2]));
    } else {
        throw new Error('Operação administrativa não suportada no modo offline local.');
    }

    if (!data || data.error || data.success === false) throw new Error(data?.error || 'Falha na operação administrativa');
    return data;
}

/** Login administrativo local. */
async function adminLogin(email, password) {
    const data = await window.db.login(email, password);
    if (!data || data.success !== true) throw new Error(data?.error || 'Falha no login');

    if (!data.user || (data.user.role !== 'admin' && data.user.role !== 'superadmin')) {
        clearAdminSession();
        throw new Error('Acesso restrito a administradores.');
    }

    _adminToken = data.accessToken || '';
    _adminUser = data.user || {};
    localStorage.setItem('adminToken', _adminToken);
    localStorage.setItem('adminUser', JSON.stringify(_adminUser));
    return data;
}

/** Renderiza a tela de Gerenciamento de Usuários */
function renderAdminUsuarios(container) {
    container.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h2 class="text-2xl font-extrabold flex items-center gap-3" style="color: var(--text-primary);">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
                        <i data-lucide="user-cog" class="w-5 h-5 text-white"></i>
                    </div>
                    Gerenciar Usuários
                </h2>
                <p class="text-sm mt-1" style="color: var(--text-muted);">Controle de acesso e permissões no banco local</p>
            </div>
        </div>

        <!-- Sessão administrativa -->
        <div id="admin-auth-section" class="rounded-2xl p-6 border shadow-sm" style="background-color: var(--card-bg); border-color: var(--border-color);">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
                <i data-lucide="key" class="w-5 h-5 text-amber-500"></i> Sessão administrativa
            </h3>
            <div id="admin-auth-status" class="mb-4">
                <div class="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <i data-lucide="alert-circle" class="w-4 h-4 text-amber-500"></i>
                    <span class="text-sm text-amber-700 dark:text-amber-300">Entre com uma conta administradora para gerenciar usuários</span>
                </div>
            </div>
            <form id="admin-login-form" onsubmit="handleAdminLogin(event)" class="space-y-3">
                <div class="flex flex-col md:flex-row gap-3">
                    <input type="email" id="admin-email" placeholder="admin@empresa.com" required class="flex-1 input-premium rounded-xl p-3 text-sm">
                    <input type="password" id="admin-password" placeholder="Senha" required class="flex-1 input-premium rounded-xl p-3 text-sm">
                </div>
                <div class="flex gap-2">
                    <button type="submit" class="px-5 py-3 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-lg flex items-center gap-2">
                        <i data-lucide="log-in" class="w-4 h-4"></i> Login
                    </button>
                </div>
            </form>
        </div>

        <!-- Painel de Usuários (aparece após login) -->
        <div id="admin-panel" class="hidden space-y-6">
            <!-- Info do Admin -->
            <div class="rounded-2xl p-4 border shadow-sm flex items-center justify-between" style="background-color: var(--card-bg); border-color: var(--border-color);">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                        <i data-lucide="shield-check" class="w-4 h-4 text-white"></i>
                    </div>
                    <div>
                        <span class="text-sm font-bold" style="color: var(--text-primary);" id="admin-info-name">Admin</span>
                        <span class="text-xs block" style="color: var(--text-muted);" id="admin-info-email">-</span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" id="admin-info-role">admin</span>
                    <button onclick="adminLogout()" class="text-xs text-red-500 hover:text-red-400 font-bold">Sair</button>
                </div>
            </div>

            <!-- Criar Usuário Diretamente -->
            <div class="rounded-2xl p-6 border shadow-sm" style="background-color: var(--card-bg); border-color: var(--border-color);">
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
                    <i data-lucide="user-check" class="w-5 h-5 text-emerald-500"></i> Criar Usuário Diretamente
                </h3>
                <p class="text-xs mb-3" style="color: var(--text-muted);">Crie a conta do usuário com nome, e-mail e senha  sem necessidade de enviar convite por e-mail.</p>
                <form onsubmit="handleCreateUserDirect(event)" class="space-y-3">
                    <div class="flex flex-col md:flex-row gap-3">
                        <input type="text" id="create-user-nome" placeholder="Nome completo" required minlength="2" class="flex-1 input-premium rounded-xl p-3 text-sm">
                        <input type="email" id="create-user-email" placeholder="email@exemplo.com" required class="flex-1 input-premium rounded-xl p-3 text-sm">
                    </div>
                    <div class="flex flex-col md:flex-row gap-3">
                        <input type="password" id="create-user-password" placeholder="Senha (mín. 6 caracteres)" required minlength="6" class="flex-1 input-premium rounded-xl p-3 text-sm">
                        <select id="create-user-role" class="input-premium rounded-xl p-3 text-sm w-40">
                            <option value="gestor">Gestor</option>
                            <option value="viewer">Visualizador</option>
                            <option value="admin">Administrador</option>
                        </select>
                        <button type="submit" class="px-5 py-3 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-lg flex items-center gap-2 whitespace-nowrap">
                            <i data-lucide="user-plus" class="w-4 h-4"></i> Criar Usuário
                        </button>
                    </div>
                </form>
                <div id="create-user-result" class="hidden mt-4 p-4 rounded-xl"></div>
            </div>

            <!-- Lista de Usuários -->
            <div class="rounded-2xl p-6 border shadow-sm" style="background-color: var(--card-bg); border-color: var(--border-color);">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold flex items-center gap-2" style="color: var(--text-primary);">
                        <i data-lucide="users" class="w-5 h-5 text-violet-500"></i> Usuários Ativos
                    </h3>
                    <button onclick="loadAdminUsers()" class="text-xs text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1">
                        <i data-lucide="refresh-cw" class="w-3 h-3"></i> Atualizar
                    </button>
                </div>
                <div id="admin-users-list" class="space-y-2">
                    <p class="text-sm text-center py-8" style="color: var(--text-muted);">Carregando...</p>
                </div>
            </div>
        </div>
    </div>`;
    refreshIcons();

    // Restaurar sessão do localStorage se ainda não tiver em memória
    if (!_adminToken || !_adminUser) {
        try {
            const savedToken = localStorage.getItem('adminToken');
            const savedUser = localStorage.getItem('adminUser');
            if (savedToken && savedUser) {
                _adminToken = savedToken;
                _adminUser = JSON.parse(savedUser);
                console.log('Sessão admin restaurada ao abrir tela de usuários.');
            }
        } catch (e) {
            console.warn('Erro ao restaurar sessão admin:', e);
        }
    }

    // Se já logado, mostrar painel direto
    if (_adminToken && _adminUser) {
        if (!isAdminSession()) {
            clearAdminSession();
            const statusEl = document.getElementById('admin-auth-status');
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <i data-lucide="shield-alert" class="w-4 h-4 text-red-500"></i>
                        <span class="text-sm text-red-700 dark:text-red-300">Acesso restrito a administradores.</span>
                    </div>`;
                refreshIcons();
            }
            return;
        }
        showAdminPanel();
    }
}

/** Faz login no backend como admin */
async function handleAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    try {
        await adminLogin(email, password);
        showAdminPanel();
        showToast('Login admin OK!');
    } catch (err) {
        const is401 = err.message.includes('inválidas') || err.message.includes('401');
        const hint = is401
            ? '<p class="text-xs mt-2 text-amber-600 dark:text-amber-400">Use a primeira conta criada no CredGestor ou outra conta administradora.</p>'
            : '';
        const isNetwork = err.message.includes('fetch') || err.message.includes('Failed') || err.message.includes('NetworkError');
        const msg = isNetwork ? 'Sem conexão com o backend. Verifique se o servidor local está rodando (porta 4000/4001).' : err.message;
        document.getElementById('admin-auth-status').innerHTML = `
            <div class="flex flex-col gap-1 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div class="flex items-center gap-2">
                    <i data-lucide="x-circle" class="w-4 h-4 text-red-500"></i>
                    <span class="text-sm text-red-700 dark:text-red-300">${S(msg)}</span>
                </div>
                ${hint}
            </div>`;
        refreshIcons();
    }
}

/** Mostra o painel de admin após login */
function showAdminPanel() {
    if (!isAdminSession()) {
        showToast('Acesso restrito a administradores.', 'error');
        return;
    }

    const authSection = document.getElementById('admin-auth-section');
    const panel = document.getElementById('admin-panel');
    if (authSection) authSection.classList.add('hidden');
    if (panel) panel.classList.remove('hidden');

    if (_adminUser) {
        const nameEl = document.getElementById('admin-info-name');
        const emailEl = document.getElementById('admin-info-email');
        const roleEl = document.getElementById('admin-info-role');
        if (nameEl) nameEl.textContent = _adminUser.nome || _adminUser.email;
        if (emailEl) emailEl.textContent = _adminUser.email;
        if (roleEl) roleEl.textContent = _adminUser.role || 'admin';
    }

    loadAdminUsers();
}

/** Carrega lista de usuários do tenant */
async function loadAdminUsers() {
    const listEl = document.getElementById('admin-users-list');
    if (!listEl) return;
    const tenantId = (_adminUser && _adminUser.tenant_id) ? _adminUser.tenant_id : 'default';

    try {
        const data = await _apiFetch(`/api/tenants/${tenantId}/users`);

        if (data.users && data.users.length > 0) {
            listEl.innerHTML = data.users.map(u => `
                <div class="flex items-center justify-between p-3 rounded-xl border" style="border-color: var(--border-color);">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${u.role === 'admin' ? 'bg-emerald-500' : u.role === 'viewer' ? 'bg-slate-500' : 'bg-blue-500'}">
                            ${S((u.nome || u.email || '?')[0].toUpperCase())}
                        </div>
                        <div>
                            <span class="text-sm font-bold block" style="color: var(--text-primary);">${S(u.nome || 'Sem nome')}</span>
                            <span class="text-xs" style="color: var(--text-muted);">${S(u.email)}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 text-[10px] font-bold rounded-lg uppercase ${u.role === 'admin' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : u.role === 'viewer' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'}">${S(u.role)}</span>
                        <span class="text-[10px]" style="color: var(--text-muted);">${u.last_login ? new Date(u.last_login).toLocaleDateString('pt-BR') : 'Nunca'}</span>
                        ${u.id !== _adminUser?.id ? `<button onclick="removeAdminUser(${Number(u.id) || 0}, '${encodeURIComponent(String(u.nome || u.email || ''))}')" class="text-red-500 hover:text-red-400 p-1 rounded" title="Remover usuário"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            listEl.innerHTML = '<p class="text-sm text-center py-4" style="color: var(--text-muted);">Nenhum usuário encontrado</p>';
        }

        refreshIcons();
    } catch (err) {
        listEl.innerHTML = `<p class="text-sm text-center py-4 text-red-500">${S(err.message)}</p>`;
    }
}

/** Cria um usuário diretamente (sem convite) */
async function handleCreateUserDirect(e) {
    e.preventDefault();
    const nome = document.getElementById('create-user-nome').value.trim();
    const email = document.getElementById('create-user-email').value.trim();
    const password = document.getElementById('create-user-password').value;
    const role = document.getElementById('create-user-role').value;
    const resultEl = document.getElementById('create-user-result');

    try {
        const data = await _apiFetch('/api/tenants/create-user', {
            method: 'POST',
            body: JSON.stringify({ nome, email, password, role }),
        });

        resultEl.className = 'mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800';
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `
            <p class="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-1">Usuário criado com sucesso!</p>
            <div class="text-xs mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" style="color: var(--text-primary);">
                <p><strong>Nome:</strong> ${S(data.user.nome)}</p>
                <p><strong>E-mail:</strong> ${S(data.user.email)}</p>
                <p><strong>Role:</strong> ${S(data.user.role)}</p>
                <p class="mt-1 text-emerald-600 dark:text-emerald-400 font-semibold">O usuário já pode fazer login com o e-mail e a senha definidos.</p>
            </div>
        `;

        document.getElementById('create-user-nome').value = '';
        document.getElementById('create-user-email').value = '';
        document.getElementById('create-user-password').value = '';

        loadAdminUsers();
        showToast('Usuário criado com sucesso!');
    } catch (err) {
        resultEl.className = 'mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800';
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `<p class="text-sm font-bold text-red-600 dark:text-red-400">${S(err.message)}</p>`;
    }
}

/** Remove um usuário do tenant */
async function removeAdminUser(userId, nome) {
    let nomeSeguro = String(nome || '');
    try { nomeSeguro = decodeURIComponent(nomeSeguro); } catch (error) { console.warn('[views] Nome de usuario codificado invalido:', error.message); }
    if (!confirm(`Remover o usuário "${nomeSeguro}" do sistema? Ele perder o acesso imediatamente.`)) return;
    try {
        const tenantId = _adminUser?.tenant_id || 'default';
        await _apiFetch(`/api/tenants/${tenantId}/users/${userId}`, { method: 'DELETE' });
        showToast('Usuário removido!');
        loadAdminUsers();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

/** Logout do admin */
function adminLogout() {
    _adminToken = null;
    _adminUser = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    renderAdminUsuarios(document.getElementById('app-content'));
    showToast('Desconectado do backend');
}
