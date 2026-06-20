// Camada de produto visual: central operacional, busca global, timeline,
// esteira de contratos e central de recibos. Sem alterar regra de negocio.

function cgSafe(value) {
    if (typeof S === 'function') return S(value);
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function cgMoney(value) {
    if (typeof formatMoney === 'function') return formatMoney(Number(value) || 0);
    return `R$ ${(Number(value) || 0).toFixed(2)}`;
}

function cgDate(value) {
    if (!value) return '-';
    try {
        if (typeof formatDate === 'function' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) return formatDate(value);
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('pt-BR');
    } catch (_) {
        return String(value);
    }
}

function cgShortDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return cgDate(value);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function cgCliente(id) {
    if (typeof getClienteById === 'function') return getClienteById(id);
    return (state.clientes || []).find(c => String(c.id) === String(id));
}

function cgIsLoanActive(emp) {
    return emp && (emp.statusGeral === 'ativo' || emp.status === 'ativo');
}

function cgLoanApproval(emp) {
    return emp?.aprovacao || 'aprovado';
}

function cgLoanRisk(emp) {
    if (!emp || !Array.isArray(emp.parcelas)) return { code: 'ok', label: 'Em dia', color: 'green' };
    const atrasadas = emp.parcelas.filter(p => {
        if (p.status !== 'pendente') return false;
        const st = typeof getStatus === 'function' ? getStatus(p.vencimento, null, emp.carenciaDias) : { code: 'ok' };
        return st.code === 'atrasado' || st.code === 'inadimplente';
    });
    if (atrasadas.some(p => (typeof getStatus === 'function' ? getStatus(p.vencimento, null, emp.carenciaDias).code : '') === 'inadimplente')) {
        return { code: 'critical', label: 'Inadimplente', color: 'red' };
    }
    if (atrasadas.length > 0) return { code: 'late', label: 'Atrasado', color: 'amber' };
    return { code: 'ok', label: 'Em dia', color: 'green' };
}

function cgGetCobrancas() {
    try {
        if (typeof getCobrancasDoDia === 'function') return getCobrancasDoDia();
    } catch (err) {
        console.warn('[product-ux] Falha ao ler cobrancas:', err.message);
    }
    return [];
}

function cgGetOperationalSnapshot() {
    const loans = state.emprestimos || [];
    const clients = state.clientes || [];
    const activeLoans = loans.filter(cgIsLoanActive);
    const emAnalise = activeLoans.filter(e => cgLoanApproval(e) === 'em_analise');
    const aprovados = activeLoans.filter(e => cgLoanApproval(e) === 'aprovado');
    const reprovados = activeLoans.filter(e => cgLoanApproval(e) === 'reprovado');
    const arquivados = activeLoans.filter(e => cgLoanApproval(e) === 'arquivado');
    const finalizados = loans.filter(e => e.statusGeral === 'finalizado' || e.status === 'finalizado');
    const blacklist = clients.filter(c => c.blacklist === true);
    const cobrancas = cgGetCobrancas();
    const inadimplentes = activeLoans.filter(e => cgLoanRisk(e).code === 'critical');
    const retornoPendente = activeLoans.reduce((acc, emp) => {
        return acc + (emp.parcelas || [])
            .filter(p => p.status === 'pendente')
            .reduce((sum, p) => sum + (Number(p.valorBase) || 0), 0);
    }, 0);

    return {
        loans,
        clients,
        activeLoans,
        emAnalise,
        aprovados,
        reprovados,
        arquivados,
        finalizados,
        blacklist,
        cobrancas,
        inadimplentes,
        retornoPendente
    };
}

function cgMiniMetric(label, value, icon, tone, sublabel) {
    const valueHtml = String(value ?? '').includes('<') ? String(value ?? '') : cgSafe(value);
    return `
        <article class="cg-metric cg-tone-${tone || 'blue'}">
            <div class="cg-metric-icon"><i data-lucide="${icon}" class="w-4 h-4"></i></div>
            <div>
                <span>${cgSafe(label)}</span>
                <strong>${valueHtml}</strong>
                ${sublabel ? `<small>${cgSafe(sublabel)}</small>` : ''}
            </div>
        </article>
    `;
}

function cgEmptyState(icon, title, text) {
    return `
        <div class="cg-empty">
            <i data-lucide="${icon}" class="w-8 h-8"></i>
            <strong>${cgSafe(title)}</strong>
            <span>${cgSafe(text)}</span>
        </div>
    `;
}

function renderOperacoes(container) {
    const snap = cgGetOperationalSnapshot();
    const totalCobranca = snap.cobrancas.reduce((acc, item) => acc + (Number(item.total || item.valor) || 0), 0);
    const aprovadosValor = snap.aprovados.reduce((acc, emp) => acc + (Number(emp.valorOriginal) || 0), 0);
    const caixa = Number(state.caixa?.saldo || 0);
    const saldoVsAprovado = caixa - aprovadosValor;

    container.innerHTML = `
        <div class="cg-page fade-in">
            <section class="cg-command">
                <div>
                    <span class="cg-eyebrow"><i data-lucide="command" class="w-3.5 h-3.5"></i> Central de Operacoes</span>
                    <h2>Fila de decisao do dia</h2>
                    <p>Uma tela para o gestor enxergar cobranca, aprovacao, risco, recibos e caixa sem procurar em varios menus.</p>
                </div>
                <div class="cg-command-actions">
                    <button onclick="router('esteira')" class="cg-btn cg-btn-primary"><i data-lucide="columns-3" class="w-4 h-4"></i> Ver esteira</button>
                    <button onclick="abrirBuscaGlobal()" class="cg-btn cg-btn-muted"><i data-lucide="search" class="w-4 h-4"></i> Busca global</button>
                </div>
            </section>

            <section class="cg-metric-grid">
                ${cgMiniMetric('Cobranca hoje', snap.cobrancas.length, 'megaphone', snap.cobrancas.length ? 'amber' : 'green', cgMoney(totalCobranca))}
                ${cgMiniMetric('Em analise', snap.emAnalise.length, 'search-check', snap.emAnalise.length ? 'amber' : 'blue', 'aguardando decisao')}
                ${cgMiniMetric('Aprovados', snap.aprovados.length, 'badge-check', snap.aprovados.length ? 'green' : 'blue', cgMoney(aprovadosValor))}
                ${cgMiniMetric('Recibos pendentes', '<span id="cg-op-recibos-count">...</span>', 'receipt-text', 'purple', 'entrega pendente')}
                ${cgMiniMetric('Risco critico', snap.inadimplentes.length, 'alert-octagon', snap.inadimplentes.length ? 'red' : 'green', `${snap.blacklist.length} bloqueado(s)`)}
            </section>

            <section class="cg-ops-balance ${saldoVsAprovado < 0 ? 'is-alert' : ''}">
                <div>
                    <span>Caixa x aprovados</span>
                    <strong>${cgMoney(caixa)} disponivel</strong>
                    <p>${snap.aprovados.length ? `${cgMoney(aprovadosValor)} em contratos aprovados para liberar` : 'Sem aprovados pendentes de liberacao'}</p>
                </div>
                <div>
                    <span>Folga operacional</span>
                    <strong>${cgMoney(saldoVsAprovado)}</strong>
                    <p>${saldoVsAprovado < 0 ? 'Caixa nao cobre todos os aprovados atuais' : 'Caixa cobre a fila aprovada'}</p>
                </div>
            </section>

            <section class="cg-work-grid">
                <article class="cg-panel">
                    <div class="cg-panel-head">
                        <div>
                            <h3><i data-lucide="calendar-clock" class="w-4 h-4"></i> Cobrancas prioritarias</h3>
                            <p>Atrasados, vencendo hoje e proximos 3 dias.</p>
                        </div>
                        <button onclick="abrirDashboardCobranca()" class="cg-icon-btn" title="Abrir cobranca do dia"><i data-lucide="arrow-up-right" class="w-4 h-4"></i></button>
                    </div>
                    <div class="cg-list">
                        ${cgRenderCobrancaPreview(snap.cobrancas)}
                    </div>
                </article>

                <article class="cg-panel">
                    <div class="cg-panel-head">
                        <div>
                            <h3><i data-lucide="file-check-2" class="w-4 h-4"></i> Aprovacao e liberacao</h3>
                            <p>Contratos que pedem decisao operacional.</p>
                        </div>
                        <button onclick="router('esteira')" class="cg-icon-btn" title="Abrir esteira"><i data-lucide="arrow-up-right" class="w-4 h-4"></i></button>
                    </div>
                    <div class="cg-list">
                        ${cgRenderLoanPreview([...snap.emAnalise, ...snap.aprovados], 'Sem contratos aguardando decisao.')}
                    </div>
                </article>

                <article class="cg-panel">
                    <div class="cg-panel-head">
                        <div>
                            <h3><i data-lucide="shield-alert" class="w-4 h-4"></i> Risco e bloqueios</h3>
                            <p>Clientes bloqueados e contratos criticos.</p>
                        </div>
                        <button onclick="abrirBlacklist()" class="cg-icon-btn" title="Abrir bloqueados"><i data-lucide="arrow-up-right" class="w-4 h-4"></i></button>
                    </div>
                    <div class="cg-list">
                        ${cgRenderRiskPreview(snap)}
                    </div>
                </article>

                <article class="cg-panel">
                    <div class="cg-panel-head">
                        <div>
                            <h3><i data-lucide="receipt-text" class="w-4 h-4"></i> Recibos pendentes</h3>
                            <p>Entrega e comprovacao dos valores liberados.</p>
                        </div>
                        <button onclick="router('recibos')" class="cg-icon-btn" title="Abrir central de recibos"><i data-lucide="arrow-up-right" class="w-4 h-4"></i></button>
                    </div>
                    <div class="cg-list" id="cg-op-recibos-list">
                        <div class="cg-loading-line">Carregando recibos...</div>
                    </div>
                </article>
            </section>
        </div>
    `;
    refreshIcons();
    cgHydrateOperacoesRecibos();
}

function cgRenderCobrancaPreview(items) {
    const rows = (items || []).slice(0, 6);
    if (!rows.length) return cgEmptyState('check-circle-2', 'Sem cobrancas urgentes', 'Nada vencendo hoje ou nos proximos dias.');
    return rows.map(item => {
        const tone = item.dias < 0 ? 'red' : (item.dias === 0 ? 'amber' : 'blue');
        const label = item.dias < 0 ? `${Math.abs(item.dias)}d atraso` : (item.dias === 0 ? 'vence hoje' : `em ${item.dias}d`);
        return `
            <button class="cg-list-row" onclick="openPaymentModal('${encodeURIComponent(String(item.empId || ''))}')">
                <span class="cg-avatar">${cgSafe(String(item.cliente || '?').charAt(0))}</span>
                <span class="cg-row-main">
                    <strong>${cgSafe(item.cliente || 'Cliente')}</strong>
                    <small>Parcela #${cgSafe(item.parcelaNum || '-')} - ${cgSafe(label)}</small>
                </span>
                <span class="cg-pill cg-pill-${tone}">${cgMoney(item.total || item.valor)}</span>
            </button>
        `;
    }).join('');
}

function cgRenderLoanPreview(loans, emptyText) {
    const rows = (loans || []).slice(0, 6);
    if (!rows.length) return cgEmptyState('clipboard-check', emptyText || 'Sem contratos nesta fila', 'A fila operacional esta limpa.');
    return rows.map(emp => {
        const cliente = cgCliente(emp.clienteId);
        const ap = cgLoanApproval(emp);
        const tone = ap === 'em_analise' ? 'amber' : (ap === 'reprovado' ? 'red' : 'green');
        const label = ap === 'em_analise' ? 'em analise' : (ap === 'arquivado' ? 'impresso' : ap);
        return `
            <button class="cg-list-row" onclick="openPaymentModal('${encodeURIComponent(String(emp.id || ''))}')">
                <span class="cg-avatar">${cgSafe((cliente?.nome || '?').charAt(0))}</span>
                <span class="cg-row-main">
                    <strong>${cgSafe(cliente?.nome || 'Cliente removido')}</strong>
                    <small>${cgDate(emp.dataInicio)} - ${cgSafe(typeof normalizeContractType === 'function' ? normalizeContractType(emp.tipo) : emp.tipo)}</small>
                </span>
                <span class="cg-stack-right">
                    <b>${cgMoney(emp.valorOriginal)}</b>
                    <em class="cg-pill cg-pill-${tone}">${cgSafe(label)}</em>
                </span>
            </button>
        `;
    }).join('');
}

function cgRenderRiskPreview(snap) {
    const rows = [];
    for (const emp of snap.inadimplentes.slice(0, 4)) {
        const cliente = cgCliente(emp.clienteId);
        rows.push(`
            <button class="cg-list-row" onclick="openPaymentModal('${encodeURIComponent(String(emp.id || ''))}')">
                <span class="cg-avatar cg-avatar-red">${cgSafe((cliente?.nome || '?').charAt(0))}</span>
                <span class="cg-row-main">
                    <strong>${cgSafe(cliente?.nome || 'Cliente')}</strong>
                    <small>Contrato com inadimplencia critica</small>
                </span>
                <span class="cg-pill cg-pill-red">critico</span>
            </button>
        `);
    }
    for (const c of snap.blacklist.slice(0, Math.max(0, 6 - rows.length))) {
        rows.push(`
            <button class="cg-list-row" onclick="abrirTimelineCliente('${cgSafe(c.id)}')">
                <span class="cg-avatar cg-avatar-red">${cgSafe((c.nome || '?').charAt(0))}</span>
                <span class="cg-row-main">
                    <strong>${cgSafe(c.nome)}</strong>
                    <small>Lista de bloqueados - score ${cgSafe(c.scoreCredito || 0)}</small>
                </span>
                <span class="cg-pill cg-pill-red">bloqueado</span>
            </button>
        `);
    }
    return rows.join('') || cgEmptyState('shield-check', 'Sem risco visivel', 'Carteira sem bloqueio ou inadimplencia critica.');
}

async function cgHydrateOperacoesRecibos() {
    const countEl = document.getElementById('cg-op-recibos-count');
    const listEl = document.getElementById('cg-op-recibos-list');
    try {
        const recibos = await cgLoadRecibosPendentes();
        if (countEl) countEl.textContent = String(recibos.length);
        if (listEl) {
            listEl.innerHTML = recibos.slice(0, 6).map(r => `
                <button class="cg-list-row" onclick="router('recibos')">
                    <span class="cg-avatar">${cgSafe((r.clienteNome || '?').charAt(0))}</span>
                    <span class="cg-row-main">
                        <strong>${cgSafe(r.clienteNome || 'Cliente')}</strong>
                        <small>${cgSafe(r.numeroRecibo || 'Recibo')} - ${cgSafe(r.parcelas || 1)} parcela(s)</small>
                    </span>
                    <span class="cg-stack-right">
                        <b>${cgMoney(r.valor)}</b>
                        <em class="cg-pill cg-pill-amber">pendente</em>
                    </span>
                </button>
            `).join('') || cgEmptyState('receipt', 'Sem recibos pendentes', 'Nenhuma entrega aguardando baixa.');
        }
        refreshIcons();
    } catch (err) {
        if (countEl) countEl.textContent = '0';
        if (listEl) listEl.innerHTML = cgEmptyState('wifi-off', 'Recibos indisponiveis', err.message || 'Nao foi possivel consultar agora.');
    }
}

async function cgLoadRecibosPendentes() {
    if (!window.db?.listarRecibosPendentes) return [];
    const data = await window.db.listarRecibosPendentes();
    if (Array.isArray(data)) return data;
    if (data?.recibos && Array.isArray(data.recibos)) return data.recibos;
    return [];
}

async function cgLoadAllRecibos() {
    const map = new Map();
    const pendentes = await cgLoadRecibosPendentes();
    pendentes.forEach(r => map.set(String(r.id), r));
    if (window.db?.listarRecibosArquivo) {
        for (const arquivo of (state.arquivoAprovados || [])) {
            try {
                const rows = await window.db.listarRecibosArquivo(arquivo.id);
                if (Array.isArray(rows)) rows.forEach(r => map.set(String(r.id), r));
            } catch (err) {
                console.warn('[product-ux] Falha ao listar recibos do arquivo:', err.message);
            }
        }
    }
    return Array.from(map.values());
}

function renderEsteiraContratos(container) {
    const snap = cgGetOperationalSnapshot();
    const columns = [
        { key: 'em_analise', title: 'Em analise', icon: 'search-check', tone: 'amber', rows: snap.emAnalise },
        { key: 'aprovado', title: 'Aprovados', icon: 'badge-check', tone: 'green', rows: snap.aprovados },
        { key: 'arquivado', title: 'Impresso / arquivo', icon: 'archive', tone: 'blue', rows: snap.arquivados },
        { key: 'reprovado', title: 'Reprovados', icon: 'x-circle', tone: 'red', rows: snap.reprovados },
        { key: 'finalizado', title: 'Finalizados', icon: 'check-circle-2', tone: 'slate', rows: snap.finalizados }
    ];

    container.innerHTML = `
        <div class="cg-page fade-in">
            <section class="cg-command cg-command-slim">
                <div>
                    <span class="cg-eyebrow"><i data-lucide="columns-3" class="w-3.5 h-3.5"></i> Esteira Visual</span>
                    <h2>Contratos por etapa</h2>
                    <p>Fluxo operacional claro para analise, aprovacao, liberacao, arquivo e finalizacao.</p>
                </div>
                <div class="cg-command-actions">
                    <button onclick="openLoanModal()" class="cg-btn cg-btn-primary"><i data-lucide="plus" class="w-4 h-4"></i> Novo contrato</button>
                    <button onclick="imprimirRelatorioAprovados()" class="cg-btn cg-btn-muted"><i data-lucide="printer" class="w-4 h-4"></i> Imprimir aprovados</button>
                </div>
            </section>

            <section class="cg-pipeline-summary">
                ${columns.map(col => cgMiniMetric(col.title, col.rows.length, col.icon, col.tone, cgMoney(col.rows.reduce((acc, e) => acc + (Number(e.valorOriginal) || 0), 0)))).join('')}
            </section>

            <section class="cg-kanban">
                ${columns.map(col => `
                    <article class="cg-kanban-col cg-tone-${col.tone}">
                        <div class="cg-kanban-head">
                            <div>
                                <span><i data-lucide="${col.icon}" class="w-4 h-4"></i>${cgSafe(col.title)}</span>
                                <strong>${col.rows.length}</strong>
                            </div>
                        </div>
                        <div class="cg-kanban-list">
                            ${cgRenderPipelineCards(col.rows, col.key)}
                        </div>
                    </article>
                `).join('')}
            </section>
        </div>
    `;
    refreshIcons();
}

function cgRenderPipelineCards(rows, key) {
    if (!rows.length) return cgEmptyState('inbox', 'Fila vazia', 'Nenhum contrato aqui.');
    return rows.slice(0, 80).map(emp => {
        const cliente = cgCliente(emp.clienteId);
        const risk = cgLoanRisk(emp);
        const parcelas = emp.parcelas || [];
        const pendentes = parcelas.filter(p => p.status === 'pendente');
        const proximo = pendentes.sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))[0];
        const tipoContrato = typeof normalizeContractType === 'function' ? normalizeContractType(emp.tipo) : emp.tipo;
        return `
            <article class="cg-deal-card" onclick="openPaymentModal('${encodeURIComponent(String(emp.id || ''))}')">
                <div class="cg-deal-top">
                    <span class="cg-avatar">${cgSafe((cliente?.nome || '?').charAt(0))}</span>
                    <div>
                        <strong>${cgSafe(cliente?.nome || 'Cliente removido')}</strong>
                        <small>${cgSafe(tipoContrato || 'contrato')} - ${cgDate(emp.dataInicio)}</small>
                    </div>
                </div>
                <div class="cg-deal-money">
                    <span>Valor</span>
                    <strong>${cgMoney(emp.valorOriginal)}</strong>
                </div>
                <div class="cg-deal-foot">
                    <span class="cg-pill cg-pill-${risk.color}">${cgSafe(risk.label)}</span>
                    <small>${proximo ? `Prox. ${cgDate(proximo.vencimento)}` : (key === 'finalizado' ? 'Quitado' : 'Sem parcela pendente')}</small>
                </div>
            </article>
        `;
    }).join('');
}

function renderCentralRecibos(container) {
    container.innerHTML = `
        <div class="cg-page fade-in">
            <section class="cg-command cg-command-slim">
                <div>
                    <span class="cg-eyebrow"><i data-lucide="receipt-text" class="w-3.5 h-3.5"></i> Central de Recibos</span>
                    <h2>Entrega, comprovacao e estorno</h2>
                    <p>Recibos viram uma area propria, sem depender do gestor lembrar que estao dentro do arquivo de aprovados.</p>
                </div>
                <div class="cg-command-actions">
                    <button onclick="router('arquivo_aprovados')" class="cg-btn cg-btn-muted"><i data-lucide="archive" class="w-4 h-4"></i> Arquivo</button>
                    <button onclick="imprimirRelatorioAprovados()" class="cg-btn cg-btn-primary"><i data-lucide="printer" class="w-4 h-4"></i> Imprimir aprovados</button>
                </div>
            </section>
            <div id="cg-recibos-root" class="cg-panel cg-loading-panel">
                <div class="cg-loading-line">Carregando recibos do banco local...</div>
            </div>
        </div>
    `;
    refreshIcons();
    cgHydrateCentralRecibos();
}

async function cgHydrateCentralRecibos(filter = 'pendente') {
    const root = document.getElementById('cg-recibos-root');
    if (!root) return;
    try {
        const recibos = await cgLoadAllRecibos();
        window._cgRecibosCache = recibos;
        cgRenderRecibosRoot(root, recibos, filter);
    } catch (err) {
        root.innerHTML = cgEmptyState('database-zap', 'Falha ao carregar recibos', err.message || 'Tente novamente.');
        refreshIcons();
    }
}

function cgRenderRecibosRoot(root, recibos, filter) {
    const pendentes = recibos.filter(r => (r.status || 'pendente') === 'pendente');
    const entregues = recibos.filter(r => r.status === 'entregue');
    const estornados = recibos.filter(r => r.status === 'estornado');
    const list = filter === 'todos' ? recibos : recibos.filter(r => (r.status || 'pendente') === filter);

    root.classList.remove('cg-loading-panel');
    root.innerHTML = `
        <section class="cg-metric-grid cg-recibo-metrics">
            ${cgMiniMetric('Pendentes', pendentes.length, 'hourglass', pendentes.length ? 'amber' : 'green', cgMoney(pendentes.reduce((a, r) => a + (Number(r.valor) || 0), 0)))}
            ${cgMiniMetric('Entregues', entregues.length, 'check-circle-2', 'green', cgMoney(entregues.reduce((a, r) => a + (Number(r.valor) || 0), 0)))}
            ${cgMiniMetric('Estornados', estornados.length, 'rotate-ccw', estornados.length ? 'red' : 'slate', cgMoney(estornados.reduce((a, r) => a + (Number(r.valor) || 0), 0)))}
            ${cgMiniMetric('Total rastreado', recibos.length, 'receipt-text', 'blue', 'recibos locais')}
        </section>
        <div class="cg-segment">
            ${[
                ['pendente', 'Pendentes'],
                ['entregue', 'Entregues'],
                ['estornado', 'Estornados'],
                ['todos', 'Todos']
            ].map(([key, label]) => `
                <button class="${filter === key ? 'is-active' : ''}" onclick="cgFiltrarRecibos('${key}')">${label}</button>
            `).join('')}
        </div>
        <div class="cg-recibo-list">
            ${cgRenderReciboRows(list)}
        </div>
    `;
    refreshIcons();
}

function cgRenderReciboRows(rows) {
    if (!rows.length) return cgEmptyState('receipt', 'Nenhum recibo nesta lista', 'Troque o filtro ou gere recibos pelo arquivo de aprovados.');
    return rows.sort((a, b) => String(b.numeroRecibo || '').localeCompare(String(a.numeroRecibo || ''))).map(r => {
        const status = r.status || 'pendente';
        const tone = status === 'entregue' ? 'green' : (status === 'estornado' ? 'red' : 'amber');
        return `
            <article class="cg-recibo-row">
                <div class="cg-recibo-main">
                    <span class="cg-avatar">${cgSafe((r.clienteNome || '?').charAt(0))}</span>
                    <div>
                        <strong>${cgSafe(r.clienteNome || 'Cliente')}</strong>
                        <small>${cgSafe(r.numeroRecibo || 'Sem numero')} - CPF ${cgSafe(r.clienteCpf || '-')}</small>
                        <em>${cgSafe(r.transferencia || 'Sem dados de transferencia')}</em>
                    </div>
                </div>
                <div class="cg-recibo-side">
                    <span class="cg-pill cg-pill-${tone}">${cgSafe(status)}</span>
                    <strong>${cgMoney(r.valor)}</strong>
                    <small>${r.dataEntrega ? `Entregue em ${cgShortDateTime(r.dataEntrega)}` : `${cgSafe(r.parcelas || 1)} parcela(s)`}</small>
                </div>
                <div class="cg-recibo-actions">
                    ${status === 'pendente' ? `<button onclick="cgMarcarReciboEntregue('${cgSafe(r.id)}')" class="cg-btn-mini cg-btn-mini-green"><i data-lucide="check" class="w-3.5 h-3.5"></i> Entregar</button>` : ''}
                    ${status === 'entregue' ? `<button onclick="cgEstornarRecibo('${cgSafe(r.id)}')" class="cg-btn-mini cg-btn-mini-red"><i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Estornar</button>` : ''}
                    ${r.emprestimoId ? `<button onclick="openPaymentModal('${encodeURIComponent(String(r.emprestimoId || ''))}')" class="cg-icon-btn" title="Abrir contrato"><i data-lucide="eye" class="w-4 h-4"></i></button>` : ''}
                </div>
            </article>
        `;
    }).join('');
}

function cgFiltrarRecibos(filter) {
    const root = document.getElementById('cg-recibos-root');
    cgRenderRecibosRoot(root, window._cgRecibosCache || [], filter);
}

async function cgMarcarReciboEntregue(reciboId) {
    if (!window.db?.marcarReciboEntregue) return showToast('Recurso de recibo indisponivel.', 'error');
    if (!confirm('Confirmar entrega deste recibo?')) return;
    const op = typeof _operadorAtual === 'function' ? _operadorAtual() : { nome: 'Gestor', email: '' };
    try {
        const res = await window.db.marcarReciboEntregue({
            reciboId,
            operadorNome: op.nome,
            operadorEmail: op.email,
            observacao: '',
            pdfHash: ''
        });
        if (!res || res.success !== true) throw new Error(res?.error || 'Falha ao marcar recibo');
        showToast(`Recibo ${res.recibo?.numeroRecibo || ''} entregue.`);
        if (typeof _processarPdfEEnvioRecibo === 'function' && res.recibo) {
            _processarPdfEEnvioRecibo(res.recibo).catch(err => console.warn('[product-ux] PDF recibo:', err.message));
        }
        cgHydrateCentralRecibos('pendente');
    } catch (err) {
        showToast('Erro ao entregar recibo: ' + (err.message || err), 'error');
    }
}

async function cgEstornarRecibo(reciboId) {
    if (!window.db?.estornarRecibo) return showToast('Recurso de estorno indisponivel.', 'error');
    const justificativa = prompt('Justificativa do estorno (minimo 5 caracteres):');
    if (!justificativa || justificativa.trim().length < 5) return showToast('Estorno cancelado.', 'warning');
    const op = typeof _operadorAtual === 'function' ? _operadorAtual() : { nome: 'Gestor', email: '' };
    try {
        const res = await window.db.estornarRecibo({
            reciboId,
            operadorNome: op.nome,
            operadorEmail: op.email,
            justificativa: justificativa.trim()
        });
        if (!res || res.success !== true) throw new Error(res?.error || 'Falha ao estornar recibo');
        showToast('Recibo estornado.');
        cgHydrateCentralRecibos('entregue');
    } catch (err) {
        showToast('Erro ao estornar: ' + (err.message || err), 'error');
    }
}

function abrirTimelineCliente(clienteId) {
    const cliente = cgCliente(clienteId);
    if (!cliente) return showToast('Cliente nao encontrado.', 'error');

    let dialog = document.getElementById('cg-timeline-dialog');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'cg-timeline-dialog';
        dialog.className = 'cg-dialog cg-timeline-dialog';
        document.body.appendChild(dialog);
    }

    const loans = (state.emprestimos || []).filter(e => String(e.clienteId) === String(clienteId));
    const eventos = cgBuildTimelineEvents(cliente, loans);
    const totalAberto = loans.filter(cgIsLoanActive).reduce((acc, emp) => acc + (emp.parcelas || [])
        .filter(p => p.status === 'pendente')
        .reduce((sum, p) => sum + (Number(p.valorBase) || 0), 0), 0);
    const score = typeof analyzeRiskCached === 'function' ? Math.round(analyzeRiskCached(cliente.id).score) : (cliente.scoreCredito || 0);

    dialog.innerHTML = `
        <div class="cg-dialog-head">
            <div>
                <span class="cg-eyebrow"><i data-lucide="history" class="w-3.5 h-3.5"></i> Timeline do Cliente</span>
                <h3>${cgSafe(cliente.nome)}</h3>
                <p>Matricula ${cgSafe(cliente.matricula || '-')} - CPF ${cgSafe(cliente.cpf || '-')}</p>
            </div>
            <button onclick="document.getElementById('cg-timeline-dialog').close()" class="cg-icon-btn" title="Fechar"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
        <section class="cg-timeline-summary">
            ${cgMiniMetric('Score', score, 'brain-circuit', score < 300 ? 'red' : (score > 700 ? 'green' : 'amber'), cliente.blacklist ? 'bloqueado' : 'ativo')}
            ${cgMiniMetric('Contratos', loans.length, 'file-text', 'blue', `${loans.filter(cgIsLoanActive).length} ativo(s)`)}
            ${cgMiniMetric('Em aberto', cgMoney(totalAberto), 'wallet-cards', totalAberto ? 'amber' : 'green', 'saldo pendente')}
        </section>
        <div class="cg-dialog-actions">
            <button onclick="openEditClienteModal('${cgSafe(cliente.id)}'); document.getElementById('cg-timeline-dialog').close();" class="cg-btn cg-btn-muted"><i data-lucide="pencil" class="w-4 h-4"></i> Editar cadastro</button>
            <button onclick="abrirCRM('${cgSafe(cliente.id)}'); document.getElementById('cg-timeline-dialog').close();" class="cg-btn cg-btn-muted"><i data-lucide="message-square-text" class="w-4 h-4"></i> CRM</button>
        </div>
        <div class="cg-timeline">
            ${eventos.map(ev => `
                <article class="cg-timeline-item cg-tone-${ev.tone}">
                    <span class="cg-timeline-dot"><i data-lucide="${ev.icon}" class="w-3.5 h-3.5"></i></span>
                    <div>
                        <small>${cgSafe(ev.dateLabel)}</small>
                        <strong>${cgSafe(ev.title)}</strong>
                        <p>${cgSafe(ev.text)}</p>
                    </div>
                </article>
            `).join('') || cgEmptyState('history', 'Sem historico suficiente', 'Acoes futuras deste cliente aparecerao aqui.')}
        </div>
    `;
    dialog.showModal();
    refreshIcons();
}

function cgBuildTimelineEvents(cliente, loans) {
    const events = [];
    events.push({
        ts: new Date(cliente.dataCadastro || cliente.createdAt || Date.now()).getTime(),
        dateLabel: cgDate(cliente.dataCadastro || cliente.createdAt),
        title: 'Cliente cadastrado',
        text: `Limite inicial ${cgMoney(cliente.limite || 0)} - vencimento dia ${cliente.diaVencimento || '-'}`,
        icon: 'user-plus',
        tone: 'blue'
    });
    if (cliente.blacklist) {
        events.push({
            ts: Date.now() + 1,
            dateLabel: 'status atual',
            title: 'Cliente na Lista de Bloqueados',
            text: `Motivo: ${cliente.motivoBloqueio || 'bloqueio registrado'} - score ${cliente.scoreCredito || 0}`,
            icon: 'shield-ban',
            tone: 'red'
        });
    }
    (cliente.contatos || []).forEach(ct => {
        const ts = new Date(`${ct.data || ''}T${ct.hora || '00:00'}`).getTime();
        events.push({
            ts: Number.isNaN(ts) ? 0 : ts,
            dateLabel: `${cgDate(ct.data)} ${ct.hora || ''}`.trim(),
            title: `Contato CRM - ${ct.tipo || 'registro'}`,
            text: ct.nota || 'Sem anotacao',
            icon: 'message-square-text',
            tone: 'purple'
        });
    });
    loans.forEach(emp => {
        const ap = cgLoanApproval(emp);
        events.push({
            ts: new Date(emp.dataInicio || emp.createdAt || 0).getTime(),
            dateLabel: cgDate(emp.dataInicio || emp.createdAt),
            title: `Contrato ${ap}`,
            text: `${cgMoney(emp.valorOriginal)} - total ${cgMoney(emp.valorTotal)} - ${emp.parcelas?.length || 0} parcela(s)`,
            icon: ap === 'reprovado' ? 'x-circle' : 'file-text',
            tone: ap === 'reprovado' ? 'red' : (ap === 'em_analise' ? 'amber' : 'green')
        });
        (emp.parcelas || []).forEach(p => {
            if (p.status === 'pago') {
                events.push({
                    ts: new Date(p.dataPagamento || p.vencimento || 0).getTime(),
                    dateLabel: cgDate(p.dataPagamento || p.vencimento),
                    title: `Parcela #${p.numero} paga`,
                    text: `${cgMoney(p.valorPago || p.valorBase)} recebido${p.multaPaga ? `, multa ${cgMoney(p.multaPaga)}` : ''}`,
                    icon: 'check-circle-2',
                    tone: 'green'
                });
            } else {
                const st = typeof getStatus === 'function' ? getStatus(p.vencimento, null, emp.carenciaDias) : { code: 'pendente', label: 'Pendente' };
                if (st.code === 'atrasado' || st.code === 'inadimplente') {
                    events.push({
                        ts: new Date(p.vencimento || 0).getTime(),
                        dateLabel: cgDate(p.vencimento),
                        title: `Parcela #${p.numero} ${st.label || 'pendente'}`,
                        text: `Valor ${cgMoney(p.valorBase)} - contrato ${String(emp.id).slice(0, 8)}`,
                        icon: 'alert-triangle',
                        tone: st.code === 'inadimplente' ? 'red' : 'amber'
                    });
                }
            }
        });
    });
    return events.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 80);
}

function abrirBuscaGlobal() {
    let dialog = document.getElementById('cg-search-dialog');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'cg-search-dialog';
        dialog.className = 'cg-dialog cg-search-dialog';
        document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
        <div class="cg-search-shell">
            <div class="cg-search-box">
                <i data-lucide="search" class="w-5 h-5"></i>
                <input id="cg-global-search-input" type="text" placeholder="Buscar cliente, matricula, CPF, telefone, contrato ou recibo" oninput="cgRenderGlobalSearch(this.value)" autocomplete="off">
                <button onclick="document.getElementById('cg-search-dialog').close()" title="Fechar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div id="cg-global-search-results" class="cg-search-results">
                ${cgRenderGlobalSearchResults('')}
            </div>
        </div>
    `;
    dialog.showModal();
    refreshIcons();
    setTimeout(() => document.getElementById('cg-global-search-input')?.focus(), 30);
    cgLoadAllRecibos().then(recibos => { window._cgRecibosCache = recibos; cgRenderGlobalSearch(''); }).catch(() => {});
}

function cgRenderGlobalSearch(query) {
    const target = document.getElementById('cg-global-search-results');
    if (target) target.innerHTML = cgRenderGlobalSearchResults(query);
    refreshIcons();
}

function cgRenderGlobalSearchResults(query) {
    const q = String(query || '').trim().toLowerCase();
    const clientes = (state.clientes || []).filter(c => {
        if (!q) return true;
        return [c.nome, c.matricula, c.cpf, c.telefone, c.email].some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, 8);

    const loans = (state.emprestimos || []).filter(emp => {
        const cliente = cgCliente(emp.clienteId);
        if (!q) return false;
        return [emp.id, emp.tipo, emp.aprovacao, cliente?.nome, cliente?.matricula, cliente?.cpf].some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, 8);

    const recibos = (window._cgRecibosCache || []).filter(r => {
        if (!q) return false;
        return [r.numeroRecibo, r.clienteNome, r.clienteCpf, r.emprestimoId].some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, 8);

    return `
        <section class="cg-search-section">
            <h4>Clientes</h4>
            ${clientes.map(c => `
                <button class="cg-search-result" onclick="abrirTimelineCliente('${cgSafe(c.id)}'); document.getElementById('cg-search-dialog').close();">
                    <span class="cg-avatar">${cgSafe((c.nome || '?').charAt(0))}</span>
                    <span>
                        <strong>${cgSafe(c.nome)}</strong>
                        <small>${cgSafe(c.matricula || '-')} - ${cgSafe(c.telefone || '-')}</small>
                    </span>
                    <i data-lucide="history" class="w-4 h-4"></i>
                </button>
            `).join('') || cgEmptyState('user-search', q ? 'Nenhum cliente' : 'Digite para buscar', 'Clientes aparecem primeiro.')}
        </section>
        <section class="cg-search-section">
            <h4>Contratos</h4>
            ${loans.map(emp => {
                const cliente = cgCliente(emp.clienteId);
                return `
                    <button class="cg-search-result" onclick="openPaymentModal('${encodeURIComponent(String(emp.id || ''))}'); document.getElementById('cg-search-dialog').close();">
                        <span class="cg-avatar">${cgSafe((cliente?.nome || '?').charAt(0))}</span>
                        <span>
                            <strong>${cgSafe(cliente?.nome || 'Cliente')}</strong>
                            <small>${cgSafe(String(emp.id).slice(0, 12))} - ${cgMoney(emp.valorOriginal)} - ${cgSafe(cgLoanApproval(emp))}</small>
                        </span>
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                `;
            }).join('') || (q ? cgEmptyState('file-search', 'Nenhum contrato', 'Tente nome, CPF ou ID.') : '')}
        </section>
        <section class="cg-search-section">
            <h4>Recibos</h4>
            ${recibos.map(r => `
                <button class="cg-search-result" onclick="router('recibos'); document.getElementById('cg-search-dialog').close();">
                    <span class="cg-avatar">${cgSafe((r.clienteNome || '?').charAt(0))}</span>
                    <span>
                        <strong>${cgSafe(r.numeroRecibo || 'Recibo')}</strong>
                        <small>${cgSafe(r.clienteNome || 'Cliente')} - ${cgMoney(r.valor)} - ${cgSafe(r.status || 'pendente')}</small>
                    </span>
                    <i data-lucide="receipt-text" class="w-4 h-4"></i>
                </button>
            `).join('') || (q ? cgEmptyState('receipt', 'Nenhum recibo', 'A central de recibos tambem pode ajudar.') : '')}
        </section>
    `;
}

document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        abrirBuscaGlobal();
    }
});
