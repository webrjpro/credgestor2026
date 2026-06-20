// SEÇÃO 15  VIEW DE CLIENTES (CRUD + Importar Excel)
// renderClientes()     ? tabela com score AI, limite, contato, ações
// handleImportExcel()  ? importa clientes de planilha .xlsx / .csv
// openNewClienteModal() / openEditClienteModal() ? formulrio KYC
// handleNewCustomer()  ? salva novo/edita cliente
// deleteCliente()      ? exclui (se sem dívidas ativas)

// -- Performance: Paginação + Lookup O(1) --
var _clientesPage = 1;
var _clientesPerPage = 50;
var _clientesSearch = '';
var _clientesStatusFilter = '';
var _clientesUseDbPagination = true;
var _clientesTotal = 0;
var _clientesPages = 0;
var _clientesCurrentRows = [];

function _mergeClientesPageIntoState(clientes) {
    if (!Array.isArray(clientes) || clientes.length === 0) return;
    const byId = new Map((state.clientes || []).map((c) => [c.id, c]));
    for (const c of clientes) {
        if (!c || !c.id) continue;
        const existing = byId.get(c.id) || {};
        byId.set(c.id, { ...existing, ...c });
    }
    state.clientes = Array.from(byId.values());
    if (window.invalidateClienteMap) window.invalidateClienteMap();
}

// Pre-computa map de credito em uso por clienteId para a pagina atual.
function _buildCreditMapForClientes(clientes) {
    const map = new Map();
    const tipoById = new Map((clientes || []).map((c) => [c.id, c.tipoLimite || 'total']));
    const targetIds = new Set((clientes || []).map((c) => c.id));

    for (const emp of state.emprestimos || []) {
        if (emp.statusGeral !== 'ativo' && emp.status !== 'ativo') continue;
        const cid = emp.clienteId;
        if (!targetIds.has(cid)) continue;
        const tipoLimite = tipoById.get(cid) || 'total';
        const tipoContrato = normalizeContractType(emp.tipo);

        let pendente = 0;
        for (const p of (emp.parcelas || [])) {
            if (p.status !== 'pendente') continue;
            const valorBase = Number(p.valorBase) || 0;
            if (tipoLimite === 'principal') {
                pendente += valorBase / (1 + ((Number(emp.taxaJuros) || 0) / 100));
            } else {
                pendente += valorBase;
            }
        }
        if (!map.has(cid)) {
            // Inicializa com todas as keys dos tipos configurados (base + extras).
            const init = {};
            for (const t of getCreditTipos()) init[t.key] = 0;
            map.set(cid, init);
        }
        const atual = map.get(cid);
        atual[tipoContrato] = (Number(atual[tipoContrato]) || 0) + pendente;
        map.set(cid, atual);
    }

    return map;
}

function _filterClientes(search) {
    if (!search) return state.clientes;
    const s = search.toLowerCase();
    return state.clientes.filter(c =>
        (c.nome && c.nome.toLowerCase().includes(s)) ||
        (c.matricula && c.matricula.toLowerCase().includes(s)) ||
        (c.cpf && c.cpf.toLowerCase().includes(s)) ||
        (c.telefone && c.telefone.toLowerCase().includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
    );
}

async function _fetchClientesPageFromDb() {
    if (!window.db?.getClientesPaginated || _clientesUseDbPagination === false) return null;
    const resp = await window.db.getClientesPaginated(_clientesPage, _clientesPerPage, _clientesSearch, _clientesStatusFilter);
    if (!resp || !Array.isArray(resp.clientes)) {
        throw new Error('Resposta invalida da paginacao de clientes');
    }

    _clientesTotal = Number(resp.total || 0);
    _clientesPages = Number(resp.pages || 0);
    _clientesCurrentRows = resp.clientes;
    _mergeClientesPageIntoState(resp.clientes);
    return resp;
}

function _renderClienteRows(clientes, creditMap) {
    return clientes.map(c => {
        const tipos = getCreditTipos();
        const defaultMap = {}; for (const t of tipos) defaultMap[t.key] = 0;
        const emUsoByTipo = creditMap.get(c.id) || defaultMap;
        const labelRegra = (c.tipoLimite === 'principal') ? 'S/ Juros' : 'C/ Juros';
        const scoreData = analyzeRiskCached(c.id);
        const limiteAprovado = Math.max(0, Number(c.limite) || 0);

        // "Limite / Uso": sumário compacto (tipo mais usado) + botão "Ver todos".
        // Escalável com muitos clientes e muitos tipos. Detalhes vão para o modal.
        let totalLimite = 0, totalUso = 0;
        let destaque = null;  // tipo com maior % de uso (para mostrar no resumo)
        let destaquePct = -1;
        for (const t of tipos) {
            const lim = getClienteLimitPorTipo(c, t.key);
            const uso = Math.max(0, Number(emUsoByTipo[t.key]) || 0);
            totalLimite += lim;
            totalUso += uso;
            const pct = lim > 0 ? (uso / lim) * 100 : 0;
            if (pct > destaquePct) { destaquePct = pct; destaque = { ...t, lim, uso, pct }; }
        }
        const pctTotal = totalLimite > 0 ? (totalUso / totalLimite) * 100 : 0;
        const destLabel = destaque ? destaque.label : (tipos[0]?.label || 'Limite');
        const destBar = destaque ? destaque.bar : 'bg-brand-500';
        const destPctClamp = Math.min(Math.max(pctTotal, 0), 100);
        const linhasLimiteUso = `
            <div>
                <div class="flex justify-between text-[10px] mb-1 font-bold">
                    <span class="text-slate-500">Uso total (${tipos.length} tipo${tipos.length > 1 ? 's' : ''})</span>
                    <span class="text-slate-400">${formatMoney(totalUso)} / ${formatMoney(totalLimite)}</span>
                </div>
                <div class="w-full bg-slate-100 dark:bg-slate-600 rounded-full h-1.5 overflow-hidden">
                    <div class="${destBar} h-1.5 rounded-full shadow-sm transition-all duration-500" style="width: ${destPctClamp}%"></div>
                </div>
                <button type="button" onclick="abrirDetalhesLimites('${c.id}')"
                    class="mt-1.5 text-[10px] font-bold text-brand-600 hover:text-brand-500 flex items-center gap-1 transition-colors"
                    title="Ver detalhamento por tipo">
                    <i data-lucide="list" class="w-3 h-3"></i> Ver limites
                    ${destaque && destaque.pct > 0 ? `<span class="ml-1 text-slate-400 font-normal">• mais usado: ${S(destLabel)} ${destaque.pct.toFixed(0)}%</span>` : ''}
                </button>
            </div>
        `;
        return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors group">
            <td class="px-4 py-4 text-center">
                ${getScoreBadge(Math.round(scoreData.score), c.id)}
            </td>
            <td class="px-4 py-4">
                <div class="flex flex-col gap-1">
                    <span class="badge cursor-pointer select-none hover:opacity-80 transition-opacity ${c.status === 'ativo' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}" onclick="toggleClienteStatus('${c.id}')" title="Clique para ${(c.status || 'ativo') === 'ativo' ? 'bloquear' : 'ativar'}">
                        ${c.status ? c.status.toUpperCase() : 'ATIVO'}
                    </span>
                    ${c.blacklist ? '<span class="badge bg-red-600 text-white text-[9px]">BLACKLIST</span>' : ''}
                </div>
            </td>
            <td class="px-4 py-4">
                <div class="flex flex-col">
                    <button type="button" onclick="abrirTimelineCliente('${c.id}')"
                        class="text-left font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 transition-colors truncate"
                        title="Abrir timeline do cliente">${S(c.nome)}</button>
                    <span class="text-[11px] text-indigo-600 font-bold">Matricula: ${S(c.matricula) || '-'}</span>
                    <span class="text-xs text-slate-400 font-mono flex items-center gap-1">
                        ${S(c.cpf) || 'Sem CPF'}
                        ${scoreData.age < 18 ? '<span class="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold">MENOR</span>' : ''}
                    </span>
                    ${c.diaVencimento ? `<span class="text-[10px] text-blue-500 font-medium mt-0.5">Venc: Dia ${c.diaVencimento}</span>` : ''}
                    <button type="button" onclick="abrirTimelineCliente('${c.id}')"
                        class="mt-1 inline-flex w-fit items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-cyan-500 hover:border-cyan-400/60 transition-colors"
                        title="Ver historico completo do cliente">
                        <i data-lucide="history" class="w-3 h-3"></i> Timeline
                    </button>
                </div>
            </td>
            <td class="px-4 py-4">
                <div class="w-full space-y-2">
                    ${linhasLimiteUso}
                    <p class="text-[9px] text-slate-400 mt-1 text-right">${labelRegra}</p>
                </div>
            </td>
            <td class="px-4 py-4">
                <div class="flex flex-col gap-0.5 min-w-0">
                    <span class="cliente-contact-text text-sm font-medium text-slate-600 dark:text-slate-400 flex items-start gap-1"><i data-lucide="phone" class="w-3 h-3 text-slate-300 mt-0.5 flex-shrink-0"></i> ${S(c.telefone)}</span>
                    <span class="cliente-contact-text text-xs text-slate-400 flex items-start gap-1"><i data-lucide="mail" class="w-3 h-3 text-slate-300 mt-0.5 flex-shrink-0"></i> ${S(c.email) || '-'}</span>
                </div>
            </td>
            <td class="px-3 py-4 text-right sticky right-0 z-10 bg-white dark:bg-slate-800" style="box-shadow:-10px 0 16px rgba(15,23,42,0.10);">
                <div class="flex justify-end gap-1.5 opacity-100">
                    <button onclick="abrirCRM('${c.id}')" class="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Contatos (CRM)"><i data-lucide="message-square-text" class="w-4 h-4"></i></button>
                    <button onclick="openEditClienteModal('${c.id}')" class="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button onclick="toggleClienteBloqueioManual('${c.id}')" class="p-2 ${c.blacklist ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30' : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30'} rounded-lg transition-all" title="${c.blacklist ? 'Desbloquear (remover da Lista de Bloqueados)' : 'Bloquear manualmente (envia para Lista de Bloqueados)'}"><i data-lucide="${c.blacklist ? 'shield-check' : 'ban'}" class="w-4 h-4"></i></button>
                    <button onclick="deleteCliente('${c.id}')" class="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function _renderPagination(filteredOrTotal, page, perPage) {
    const total = Array.isArray(filteredOrTotal)
        ? filteredOrTotal.length
        : Math.max(0, Number(filteredOrTotal || 0));
    const totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) return '';
    const start = (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    let btns = '';
    btns += `<button onclick="clientesGoPage(1)" class="px-2.5 py-1.5 rounded-lg text-xs font-bold ${page === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300'}" ${page === 1 ? 'disabled' : ''}>&laquo;</button>`;
    btns += `<button onclick="clientesGoPage(${page - 1})" class="px-2.5 py-1.5 rounded-lg text-xs font-bold ${page === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300'}" ${page === 1 ? 'disabled' : ''}>&lsaquo;</button>`;

    let startP = Math.max(1, page - 2);
    let endP = Math.min(totalPages, startP + 4);
    if (endP - startP < 4) startP = Math.max(1, endP - 4);
    for (let i = startP; i <= endP; i++) {
        btns += `<button onclick="clientesGoPage(${i})" class="px-3 py-1.5 rounded-lg text-xs font-bold ${i === page ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300'}">${i}</button>`;
    }

    btns += `<button onclick="clientesGoPage(${page + 1})" class="px-2.5 py-1.5 rounded-lg text-xs font-bold ${page === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300'}" ${page === totalPages ? 'disabled' : ''}>&rsaquo;</button>`;
    btns += `<button onclick="clientesGoPage(${totalPages})" class="px-2.5 py-1.5 rounded-lg text-xs font-bold ${page === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300'}" ${page === totalPages ? 'disabled' : ''}>&raquo;</button>`;

    return `
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <p class="text-xs text-slate-400 font-medium">Mostrando <strong class="text-slate-600 dark:text-slate-300">${start}-${end}</strong> de <strong class="text-slate-600 dark:text-slate-300">${total}</strong> clientes</p>
        <div class="flex items-center gap-1">${btns}</div>
    </div>`;
}

function clientesGoPage(p) {
    const totalPages = _clientesUseDbPagination
        ? Math.max(1, Math.ceil(Math.max(0, Number(_clientesTotal || 0)) / _clientesPerPage))
        : Math.max(1, Math.ceil(_filterClientes(_clientesSearch).length / _clientesPerPage));
    _clientesPage = Math.max(1, Math.min(p, totalPages));
    _updateClientesTable();
}

function clientesSearchHandler(value) {
    _clientesSearch = value;
    _clientesPage = 1;
    _updateClientesTable();
}

// Atualiza APENAS o tbody + paginacao (sem recriar toda a pagina)
async function _updateClientesTable() {
    const tbody = document.getElementById('clientes-tbody');
    const pagArea = document.getElementById('clientes-pagination');
    const emptyArea = document.getElementById('clientes-empty');

    if (_clientesUseDbPagination && window.db?.getClientesPaginated) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-slate-400 text-sm">
                        Carregando clientes...
                    </td>
                </tr>
            `;
        }

        try {
            await _fetchClientesPageFromDb();
            const totalPages = Math.max(1, Math.ceil(Math.max(0, _clientesTotal) / _clientesPerPage));
            if (_clientesPage > totalPages) {
                _clientesPage = totalPages;
                await _fetchClientesPageFromDb();
            }

            const creditMap = _buildCreditMapForClientes(_clientesCurrentRows);
            if (tbody) tbody.innerHTML = _renderClienteRows(_clientesCurrentRows, creditMap);
            if (pagArea) pagArea.innerHTML = _renderPagination(_clientesTotal, _clientesPage, _clientesPerPage);
            if (emptyArea) emptyArea.style.display = _clientesTotal === 0 ? '' : 'none';
            refreshIcons();
            return;
        } catch (err) {
            console.warn('[Clientes] Falha no modo paginado via banco, voltando para memoria:', err?.message || err);
            _clientesUseDbPagination = false;
        }
    }

    const filtered = _filterClientes(_clientesSearch);
    const totalPages = Math.ceil(filtered.length / _clientesPerPage);
    if (_clientesPage > totalPages) _clientesPage = Math.max(1, totalPages);
    const start = (_clientesPage - 1) * _clientesPerPage;
    const pageItems = filtered.slice(start, start + _clientesPerPage);
    const creditMap = _buildCreditMapForClientes(pageItems);

    if (tbody) tbody.innerHTML = _renderClienteRows(pageItems, creditMap);
    if (pagArea) pagArea.innerHTML = _renderPagination(filtered, _clientesPage, _clientesPerPage);
    if (emptyArea) emptyArea.style.display = filtered.length === 0 ? '' : 'none';
    refreshIcons();
}

var _clientesSearchTimer = null;
function renderClientes(container) {
    _clientesPage = 1;
    _clientesSearch = '';
    _clientesStatusFilter = '';
    _clientesUseDbPagination = !!window.db?.getClientesPaginated;
    _clientesTotal = _clientesUseDbPagination ? 0 : ((state.clientes || []).length);
    _clientesPages = 0;
    _clientesCurrentRows = [];

    const allClientes = _clientesUseDbPagination ? [] : state.clientes;
    const pageItems = _clientesUseDbPagination ? [] : allClientes.slice(0, _clientesPerPage);
    const creditMap = _buildCreditMapForClientes(pageItems);

    container.innerHTML = `
        <div class="space-y-6 fade-in">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex-1 max-w-md w-full">
                    <div class="relative">
                        <i data-lucide="search" class="absolute left-3 top-3 h-5 w-5 text-slate-400"></i>
                        <input type="text" id="clientes-search-input" placeholder="Buscar por nome, matricula, CPF, telefone..." class="pl-10 pr-4 py-3 w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none shadow-sm text-sm transition-all dark:text-slate-200">
                    </div>
                    <div id="import-progress-wrapper" class="hidden mt-2">
                        <div class="flex items-center gap-3">
                            <div class="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div id="import-progress-bar" class="h-full bg-gradient-to-r from-emerald-500 to-brand-500 rounded-full transition-all duration-300" style="width:0%"></div>
                            </div>
                            <span id="import-progress-text" class="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">0%</span>
                        </div>
                        <p id="import-progress-detail" class="text-[10px] text-slate-400 mt-1">Preparando importacao...</p>
                    </div>
                </div>
                <div class="flex gap-2 w-full md:w-auto">
                    <input type="file" id="import-excel" hidden accept=".xlsx, .xls, .csv" onchange="handleImportExcel(event)">
                    <button onclick="document.getElementById('import-excel').click()" class="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all text-sm font-bold">
                        <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600"></i> Importar
                    </button>
                    <button onclick="openNewClienteModal()" class="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all transform hover:-translate-y-0.5 text-sm font-bold">
                        <i data-lucide="plus" class="w-4 h-4"></i> Novo Cliente
                    </button>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div class="clientes-table-shell">
                    <table class="w-full text-left text-sm" id="clientes-table" style="table-layout:fixed;">
                        <thead class="bg-slate-50/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-600">
                            <tr>
                                <th class="px-4 py-4 text-center" style="width:12%;">Score AI</th>
                                <th class="px-4 py-4" style="width:10%;">Status</th>
                                <th class="px-4 py-4" style="width:21%;">Cliente</th>
                                <th class="px-4 py-4" style="width:23%;">Limite / Uso</th>
                                <th class="px-4 py-4" style="width:19%;">Contato</th>
                                <th class="px-3 py-4 text-right sticky right-0 z-20 bg-slate-50/95 dark:bg-slate-700" style="width:15%;box-shadow:-10px 0 16px rgba(15,23,42,0.10);">Acoes</th>
                            </tr>
                        </thead>
                        <tbody id="clientes-tbody" class="divide-y divide-slate-50 dark:divide-slate-700">
                            ${_clientesUseDbPagination ? `
                                <tr>
                                    <td colspan="6" class="px-6 py-8 text-center text-slate-400 text-sm">Carregando clientes...</td>
                                </tr>
                            ` : _renderClienteRows(pageItems, creditMap)}
                        </tbody>
                    </table>
                    <div id="clientes-empty" style="${(!_clientesUseDbPagination && state.clientes.length === 0) ? '' : 'display:none'}">
                        <div class="flex flex-col items-center justify-center p-12 text-center">
                            <div class="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4"><i data-lucide="users" class="w-8 h-8 text-slate-300"></i></div>
                            <p class="text-slate-500 font-medium">Nenhum cliente cadastrado.</p>
                            <p class="text-slate-400 text-sm mt-1">Comece clicando em "Novo Cliente".</p>
                        </div>
                    </div>
                </div>
                <div id="clientes-pagination">${_clientesUseDbPagination ? '' : _renderPagination(allClientes, 1, _clientesPerPage)}</div>
            </div>
        </div>
    `;

    const searchInput = document.getElementById('clientes-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            clearTimeout(_clientesSearchTimer);
            _clientesSearchTimer = setTimeout(() => clientesSearchHandler(this.value), 250);
        });
    }

    _updateClientesTable();
}
function normalizeMatriculaLocal(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toUpperCase().slice(0, 64);
}

function generateMatriculaLocal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(16).slice(2, 6).toUpperCase().padEnd(4, '0');
    return `MAT-${y}${m}${d}-${rand}`;
}

function collectUsedMatriculas(excludeId = '') {
    const used = new Set();
    for (const c of state.clientes) {
        if (excludeId && c.id === excludeId) continue;
        const mk = normalizeMatriculaLocal(c.matricula || '');
        if (mk) used.add(mk);
    }
    return used;
}

function ensureUniqueMatriculaLocal(inputMatricula, usedSet) {
    const clean = normalizeMatriculaLocal(inputMatricula);
    if (clean) {
        if (usedSet.has(clean)) return { ok: false, matricula: '', reason: 'duplicate' };
        usedSet.add(clean);
        return { ok: true, matricula: clean };
    }

    for (let i = 0; i < 20; i++) {
        const generated = generateMatriculaLocal();
        if (!usedSet.has(generated)) {
            usedSet.add(generated);
            return { ok: true, matricula: generated };
        }
    }

    const fallback = `MAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    usedSet.add(fallback);
    return { ok: true, matricula: fallback };
}

function normalizeExcelHeaderKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function buildExcelRowLookup(row) {
    const lookup = new Map();
    Object.keys(row || {}).forEach((key) => {
        lookup.set(normalizeExcelHeaderKey(key), row[key]);
    });
    return lookup;
}

function hasExcelValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
}

function pickExcelValue(row, rowLookup, aliases, fallback = '') {
    for (const alias of aliases) {
        if (Object.prototype.hasOwnProperty.call(row, alias) && hasExcelValue(row[alias])) {
            return row[alias];
        }
    }
    for (const alias of aliases) {
        const key = normalizeExcelHeaderKey(alias);
        if (rowLookup.has(key)) {
            const value = rowLookup.get(key);
            if (hasExcelValue(value)) return value;
        }
    }
    return fallback;
}

function toExcelString(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return '';
        if (Number.isInteger(value)) return String(value);
        return String(value);
    }
    return String(value).trim();
}

function parseExcelDate(value) {
    if (!hasExcelValue(value)) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().split('T')[0];
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 25000 && value < 60000) {
        const excelEpoch = new Date(1899, 11, 30);
        const dt = new Date(excelEpoch.getTime() + Number(value) * 86400000);
        return dt.toISOString().split('T')[0];
    }

    const raw = toExcelString(value);
    if (!raw) return '';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
        const [d, m, y] = raw.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(raw)) {
        const [d, m, y] = raw.split('-');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }
    return '';
}

function parseExcelMoney(value, fallback = 2000) {
    if (!hasExcelValue(value)) return fallback;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
    }

    let raw = toExcelString(value);
    if (!raw) return fallback;
    raw = raw.replace(/\s/g, '').replace(/R\$/ig, '');

    if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(raw)) {
        raw = raw.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d+,\d+$/.test(raw)) {
        raw = raw.replace(',', '.');
    } else {
        raw = raw.replace(/,/g, '');
    }

    raw = raw.replace(/[^\d.-]/g, '');
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
}

function parseExcelDiaVencimento(value) {
    if (!hasExcelValue(value)) return '';
    const raw = toExcelString(value);
    const match = raw.match(/\d{1,2}/);
    if (!match) return '';
    const dia = Number(match[0]);
    if (!Number.isFinite(dia) || dia < 1 || dia > 31) return '';
    return String(dia);
}

function parseExcelRegraCalculo(value) {
    const raw = normalizeExcelHeaderKey(toExcelString(value));
    if (!raw) return 'total';
    if (raw.includes('principal') || raw.includes('semjuros') || raw === 'sjuro' || raw === 'sjuros') {
        return 'principal';
    }
    return 'total';
}

function parseExcelTipoPagamento(value, refs = {}) {
    const raw = normalizeExcelHeaderKey(toExcelString(value));
    if (raw.includes('pix')) return 'pix';
    if (raw.includes('ted') || raw.includes('doc') || raw.includes('transfer') || raw.includes('banco')) return 'ted';
    if (raw === 'nenhum' || raw === 'na' || raw === 'nao' || raw === 'naoinformado') return '';

    // inferência por campos preenchidos para replicar cadastro manual
    if (toExcelString(refs.chavePix)) return 'pix';
    if (toExcelString(refs.banco) || toExcelString(refs.agencia) || toExcelString(refs.operacao) || toExcelString(refs.conta)) return 'ted';
    return '';
}

// -- Importação de Clientes via Excel (.xlsx / .csv) --
function handleImportExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        // -- UI: mostrar barra de progresso --
        const progressWrapper = document.getElementById('import-progress-wrapper');
        const progressBar = document.getElementById('import-progress-bar');
        const progressText = document.getElementById('import-progress-text');
        const progressDetail = document.getElementById('import-progress-detail');
        if (progressWrapper) progressWrapper.classList.remove('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        if (progressDetail) progressDetail.textContent = 'Lendo arquivo...';

        let salvos = 0;
        let totalNovos = 0;

        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: false });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: true });

            if (jsonData.length === 0) {
                alert("O arquivo Excel parece estar vazio ou não pôde ser lido.");
                return;
            }
            if (progressDetail) progressDetail.textContent = `Lendo ${jsonData.length} registros...`;

            // ndices de duplicidade (CPF e matrícula)
            const existentesPorCpf = new Map();
            const matriculasUsadas = collectUsedMatriculas();
            state.clientes.forEach(c => {
                if (c.cpf && c.cpf.replace(/\D/g, '').length >= 11) existentesPorCpf.set(c.cpf.replace(/\D/g, ''), c);
            });

            // -- Pré-processar todos os registros (rápido, só monta objetos) --
            let duplicados = 0;
            let linhasVazias = 0;
            let duplicadosMatricula = 0;
            const todosNovos = [];
            const baseTs = Date.now();
            jsonData.forEach((row, idx) => {
                const rowLookup = buildExcelRowLookup(row);

                const nome = pickExcelValue(row, rowLookup, [
                    'Nome Completo', 'Nome', 'Cliente', 'NOME COMPLETO', 'nome completo', 'nome_completo'
                ]);
                const cpfRaw = pickExcelValue(row, rowLookup, [
                    'CPF_CNPJ', 'CPF / CNPJ', 'CPF/CNPJ', 'CPF', 'CNPJ', 'cpf_cnpj', 'cpfcnpj'
                ]);
                const matriculaRaw = pickExcelValue(row, rowLookup, [
                    'Matrícula', 'Matricula', 'MATRICULA', 'MATRÍCULA', 'matricula', 'matrícula', 'Registro', 'REGISTRO'
                ], '');
                const telefoneRaw = pickExcelValue(row, rowLookup, [
                    'Telefone', 'Telefone / WhatsApp', 'Celular', 'Fone', 'telefone_whatsapp'
                ]);
                const emailRaw = pickExcelValue(row, rowLookup, [
                    'Email', 'E-mail', 'Email (Opcional)', 'EMAIL'
                ]);
                const limiteRaw = pickExcelValue(row, rowLookup, [
                    'Limite_Aprovado', 'Limite Aprovado', 'Limite Crédito (R$)', 'Limite', 'LIMITE'
                ]);
                const vencimentoRaw = pickExcelValue(row, rowLookup, [
                    'Dia_Vencimento', 'Dia Vencimento', 'Vencimento Preferencial', 'Vencimento'
                ]);
                const regraCalculoRaw = pickExcelValue(row, rowLookup, [
                    'Regra_Calculo', 'Regra Cálculo', 'Regra de Cálculo de Limite', 'Regra de Cálculo', 'Tipo Limite'
                ]);
                const observacoesRaw = pickExcelValue(row, rowLookup, [
                    'Observacoes', 'Observações', 'Observacao', 'Observação', 'Obs', 'obs'
                ]);
                const nascimentoRaw = pickExcelValue(row, rowLookup, [
                    'Data_Nascimento', 'Data Nascimento', 'Data de Nascimento', 'Nascimento', 'Dt Nascimento', 'Dt. Nascimento'
                ], '');

                const tipoPagamentoRaw = pickExcelValue(row, rowLookup, [
                    'Tipo_Pagamento', 'Tipo Pagamento', 'Pagamento', 'tipo_pagamento'
                ]);
                const bancoRaw = pickExcelValue(row, rowLookup, ['Banco', 'BANCO', 'banco']);
                const agenciaRaw = pickExcelValue(row, rowLookup, ['Agencia', 'Agência', 'AGENCIA', 'AGÊNCIA']);
                const operacaoRaw = pickExcelValue(row, rowLookup, ['Operacao', 'Operação', 'OPERACAO', 'OPERAÇÃO']);
                const contaRaw = pickExcelValue(row, rowLookup, ['Conta', 'CONTA', 'conta']);
                const chavePixRaw = pickExcelValue(row, rowLookup, ['Chave_PIX', 'Chave PIX', 'ChavePix', 'PIX', 'pix']);

                if (nome && String(nome).trim().length > 0) {
                    const nomeClean = String(nome).trim();
                    const cpfText = toExcelString(cpfRaw);
                    const cpfClean = cpfText ? cpfText.replace(/\D/g, '') : '';

                    // Duplicata SOMENTE por CPF (identificador nico no Brasil)
                    // Nomes podem se repetir  "Joo Silva" pode ser pessoas diferentes
                    if (cpfClean.length >= 11 && existentesPorCpf.has(cpfClean)) { duplicados++; return; }

                    const matriculaCheck = normalizeMatriculaLocal(String(matriculaRaw || ''));
                    if (matriculaCheck && matriculasUsadas.has(matriculaCheck)) { duplicadosMatricula++; return; }

                    const dataNascFormatada = parseExcelDate(nascimentoRaw);
                    const limite = parseExcelMoney(limiteRaw, 2000);
                    const diaVencimento = parseExcelDiaVencimento(vencimentoRaw);
                    const tipoLimite = parseExcelRegraCalculo(regraCalculoRaw);
                    const banco = toExcelString(bancoRaw);
                    const agencia = toExcelString(agenciaRaw);
                    const operacao = toExcelString(operacaoRaw);
                    const conta = toExcelString(contaRaw);
                    const chavePix = toExcelString(chavePixRaw);
                    const tipoPagamento = parseExcelTipoPagamento(tipoPagamentoRaw, { banco, agencia, operacao, conta, chavePix });
                    const obsExcel = toExcelString(observacoesRaw);

                    const uniqueId = String(baseTs) + String(idx).padStart(5, '0');
                    const matriculaResolved = ensureUniqueMatriculaLocal(String(matriculaRaw || ''), matriculasUsadas);
                    if (!matriculaResolved.ok) { duplicadosMatricula++; return; }
                    const cliente = {
                        id: uniqueId, nome: nomeClean,
                        matricula: matriculaResolved.matricula,
                        cpf: cpfText || '',
                        dataNascimento: dataNascFormatada,
                        telefone: toExcelString(telefoneRaw) || 'Não Informado',
                        email: toExcelString(emailRaw),
                        limite, tipoLimite,
                        diaVencimento,
                        obs: obsExcel || 'Importado via Excel',
                        tipoPagamento, banco, agencia, operacao, conta, chavePix,
                        status: 'ativo',
                        dataCadastro: new Date().toISOString().split('T')[0],
                        scoreManual: null, scoreGestor: null,
                        scoreCredito: 500, pagamentosEmDia: 0,
                        blacklist: false, motivoBloqueio: '', contatos: []
                    };
                    todosNovos.push(cliente);
                    if (cpfClean.length >= 11) existentesPorCpf.set(cpfClean, cliente);
                } else {
                    linhasVazias++;
                }
            });

            // -- Gravar em lotes de 300 com barra de progresso --
            const BATCH_SIZE = 300;
            totalNovos = todosNovos.length;
            if (totalNovos === 0) {
                const detalhesZero = [];
                if (duplicados > 0) detalhesZero.push(`${duplicados} CPFs duplicados ignorados`);
                if (duplicadosMatricula > 0) detalhesZero.push(`${duplicadosMatricula} matrículas duplicadas ignoradas`);
                if (linhasVazias > 0) detalhesZero.push(`${linhasVazias} linhas sem nome ignoradas`);
                const msgZero = detalhesZero.length > 0 ? ` (${detalhesZero.join(', ')})` : '';
                if (progressBar) progressBar.style.width = '100%';
                if (progressText) progressText.textContent = '100%';
                if (progressDetail) progressDetail.textContent = `Nenhum novo cliente para importar${msgZero}.`;
                showToast(`Nenhum novo cliente encontrado${msgZero}.`, 'warning');
                return;
            }

            let falhasPersistencia = 0;
            for (let i = 0; i < totalNovos; i += BATCH_SIZE) {
                const lote = todosNovos.slice(i, i + BATCH_SIZE);
                const persistResult = await persistBatchClientes(lote);
                if (!persistResult || persistResult.success !== true) {
                    // Fallback cirrgico: tenta salvar um a um para isolar registros inválidos
                    for (const cliente of lote) {
                        const singleResult = await persistCliente(cliente);
                        if (singleResult && singleResult.success === true) {
                            state.clientes.push(singleResult.cliente || cliente);
                            salvos += 1;
                        } else {
                            falhasPersistencia += 1;
                        }
                    }
                } else {
                    // Só atualiza memória depois da confirmação em disco
                    lote.forEach(c => state.clientes.push(c));
                    salvos += lote.length;
                }

                // Atualizar barra de progresso
                const pct = Math.round((salvos / totalNovos) * 100);
                if (progressBar) progressBar.style.width = pct + '%';
                if (progressText) progressText.textContent = pct + '%';
                if (progressDetail) {
                    if (falhasPersistencia > 0) {
                        progressDetail.textContent = `${salvos} de ${totalNovos} clientes salvos... (${falhasPersistencia} falha(s) de validação)`;
                    } else {
                        progressDetail.textContent = `${salvos} de ${totalNovos} clientes salvos...`;
                    }
                }

                // Liberar o event loop para a UI atualizar
                await new Promise(r => setTimeout(r, 30));
            }

            // -- Finalizar --
            if (progressBar) progressBar.style.width = '100%';
            if (progressText) progressText.textContent = '100%';
            const detalhes = [];
            if (duplicados > 0) detalhes.push(`${duplicados} CPFs duplicados ignorados`);
            if (duplicadosMatricula > 0) detalhes.push(`${duplicadosMatricula} matrículas duplicadas ignoradas`);
            if (linhasVazias > 0) detalhes.push(`${linhasVazias} linhas sem nome ignoradas`);
            if (salvos < totalNovos) detalhes.push(`${totalNovos - salvos} linhas com erro de persistência`);
            const msgDetalhes = detalhes.length > 0 ? ` (${detalhes.join(', ')})` : '';
            if (progressDetail) progressDetail.textContent = `${salvos} importados com sucesso!${msgDetalhes}`;

            renderClientes(document.getElementById('app-content'));
            showToast(`${salvos} clientes importados!${msgDetalhes}`);

            // Reconciliar estado com o banco após import em lote
            await reconcileState();

            // Esconder barra após 4s
            setTimeout(() => {
                const pw = document.getElementById('import-progress-wrapper');
                if (pw) pw.classList.add('hidden');
            }, 4000);
        } catch (err) {
            console.error('Erro ao importar Excel:', err);
            const msgErro = err?.message || 'erro desconhecido ao importar planilha';
            const pct = totalNovos > 0 ? Math.round((salvos / totalNovos) * 100) : 0;
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressText) progressText.textContent = `${pct}%`;
            if (progressDetail) progressDetail.textContent = `? Falha na importação. ${salvos} cliente(s) salvos antes da falha. Motivo: ${msgErro}`;
            showToast(`Falha na importação: ${msgErro}`, 'error');

            if (salvos > 0) {
                renderClientes(document.getElementById('app-content'));
                await reconcileState();
            }
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}
