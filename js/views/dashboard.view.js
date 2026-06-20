// SEÇÃO 12  DASHBOARD (Cards + Gráficos Chart.js)
// renderDashboard() ? monta a tela principal com:
//    5 cards de resumo (saldo, capital, retorno, recebido, inadimplentes)
//    Gráfico de barras (fluxo 7 dias)
//    Gráfico doughnut (status dos contratos)
//    Lista de atividade recente (Últimos 5 empréstimos)
//    Calculadora rápida embutida
//    Agenda do dia (vencimentos de hoje)
let mainChartInstance = null;
let pieChartInstance = null;
let trendChartInstance = null;

function renderDashboard(container) {
    checkNotifications(); // Atualiza notificações

    let totalEmprestado = 0;
    let totalReceber = 0;
    let totalRecebido = 0;
    let inadimplentes = 0;
    let contratosAtivos = 0;
    let lucroTotal = 0;

    // Dados para gráficos
    const ultimos7Dias = [];
    const hoje = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - i);
        ultimos7Dias.push({
            data: d.toISOString().split('T')[0],
            label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
            recebido: 0,
            emprestado: 0
        });
    }

    state.emprestimos.forEach(emp => {
        if (emp.statusGeral === 'ativo') {
            totalEmprestado += emp.valorOriginal;
            lucroTotal += (emp.valorTotal - emp.valorOriginal);
            contratosAtivos++;
            const pendente = emp.parcelas.filter(p => p.status === 'pendente')
                .reduce((acc, p) => acc + p.valorBase, 0);
            totalReceber += pendente;
            const temInadimplencia = emp.parcelas.some(p => p.status === 'pendente' && getStatus(p.vencimento, null, emp.carenciaDias).code === 'inadimplente');
            if (temInadimplencia) inadimplentes++;

            // Mapear empréstimos por dia
            const diaEmp = emp.dataInicio;
            const idx = ultimos7Dias.findIndex(d => d.data === diaEmp);
            if (idx !== -1) ultimos7Dias[idx].emprestado += emp.valorOriginal;
        }

        // Pagamentos recebidos
        emp.parcelas.forEach(p => {
            if (p.status === 'pago' && p.valorPago > 0) {
                totalRecebido += p.valorPago;
                const diaPag = p.dataPagamento;
                const idx = ultimos7Dias.findIndex(d => d.data === diaPag);
                if (idx !== -1) ultimos7Dias[idx].recebido += p.valorPago;
            }
        });
    });

    const taxaAdimplencia = contratosAtivos > 0 ? Math.round(((contratosAtivos - inadimplentes) / contratosAtivos) * 100) : 100;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (taxaAdimplencia / 100) * circumference;
    const gestorNome = (typeof getGestorName === 'function' ? getGestorName() : 'Gestor') || 'Gestor';
    const fluxoSemana = ultimos7Dias.reduce((acc, dia) => acc + dia.recebido - dia.emprestado, 0);
    const riscoOperacional = inadimplentes > 0 ? 'Atencao' : 'Estavel';
    const riscoDescricao = inadimplentes > 0
        ? `${inadimplentes} contrato${inadimplentes > 1 ? 's' : ''} exigem acao`
        : 'Carteira sem alerta critico';
    const cobrancasHoje = (typeof cgGetCobrancas === 'function') ? cgGetCobrancas() : [];
    const contratosEmAnalise = state.emprestimos.filter(emp => emp.statusGeral === 'ativo' && (emp.aprovacao || 'aprovado') === 'em_analise').length;
    const contratosAprovados = state.emprestimos.filter(emp => emp.statusGeral === 'ativo' && (emp.aprovacao || 'aprovado') === 'aprovado').length;
    const clientesBloqueados = state.clientes.filter(c => c.blacklist === true).length;

    container.innerHTML = `
        <div class="dashboard-command fade-in">
            <!-- Command Header -->
            <section class="dashboard-hero">
                <div class="dashboard-hero-copy">
                    <div class="dashboard-eyebrow">
                        <span class="dashboard-live-dot"></span>
                        Financeiro offline
                    </div>
                    <h2>${getSaudacao()}, ${S(gestorNome)}.</h2>
                    <p>Visao executiva do caixa, carteira, retorno e risco operacional.</p>
                </div>
                <div class="dashboard-hero-actions">
                    <div class="dashboard-hero-balance">
                        <span>Caixa disponivel</span>
                        <strong>${formatMoney(state.caixa.saldo)}</strong>
                    </div>
                    <button onclick="openLoanModal()" class="dashboard-primary-action">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Novo Emprestimo
                    </button>
                </div>
            </section>

            <section class="dashboard-exec-strip">
                <button onclick="router('operacoes')" class="dashboard-exec-card is-primary">
                    <span><i data-lucide="command" class="w-4 h-4"></i> Central de Operacoes</span>
                    <strong>Fila do dia</strong>
                    <small>${cobrancasHoje.length + contratosEmAnalise + clientesBloqueados} item(ns) pedem atencao</small>
                </button>
                <button onclick="abrirDashboardCobranca()" class="dashboard-exec-card">
                    <span><i data-lucide="megaphone" class="w-4 h-4"></i> Cobrancas</span>
                    <strong>${cobrancasHoje.length}</strong>
                    <small>vencidas ou proximas</small>
                </button>
                <button onclick="router('esteira')" class="dashboard-exec-card">
                    <span><i data-lucide="columns-3" class="w-4 h-4"></i> Esteira</span>
                    <strong>${contratosEmAnalise + contratosAprovados}</strong>
                    <small>em analise/aprovados</small>
                </button>
                <button onclick="router('recibos')" class="dashboard-exec-card">
                    <span><i data-lucide="receipt-text" class="w-4 h-4"></i> Recibos</span>
                    <strong id="dashboard-recibos-count">...</strong>
                    <small>pendentes de entrega</small>
                </button>
            </section>

            <!-- Financial Command KPIs -->
            <section class="dashboard-kpi-grid" id="dash-cards-grid">
                <article class="dashboard-kpi dashboard-kpi-primary card-enter">
                    <div class="dashboard-kpi-top">
                        <div>
                            <p class="dashboard-kpi-label">Caixa atual</p>
                            <h3 class="dashboard-kpi-value counter-reveal" id="dash-caixa" data-counter-target="${state.caixa.saldo}">${formatMoney(state.caixa.saldo)}</h3>
                            <p class="dashboard-kpi-meta">Capital pronto para operacao</p>
                        </div>
                        <div class="dashboard-kpi-icon dashboard-kpi-icon-green">
                            <i data-lucide="wallet" class="w-6 h-6"></i>
                        </div>
                    </div>
                    <button onclick="abrirModalAporte()" class="dashboard-secondary-action">
                        <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                        Adicionar Capital
                    </button>
                </article>

                <article class="dashboard-kpi card-enter">
                    <div class="dashboard-kpi-top">
                        <div>
                            <p class="dashboard-kpi-label">Capital em rua</p>
                            <h3 class="dashboard-kpi-value counter-reveal" data-counter-target="${totalEmprestado}">${formatMoney(totalEmprestado)}</h3>
                            <p class="dashboard-kpi-meta">${contratosAtivos} contratos ativos</p>
                        </div>
                        <div class="dashboard-kpi-icon dashboard-kpi-icon-blue"><i data-lucide="trending-up" class="w-5 h-5"></i></div>
                    </div>
                </article>
                
                <article class="dashboard-kpi card-enter">
                    <div class="dashboard-kpi-top">
                        <div>
                            <p class="dashboard-kpi-label">Retorno previsto</p>
                            <h3 class="dashboard-kpi-value counter-reveal" data-counter-target="${totalReceber}">${formatMoney(totalReceber)}</h3>
                            <p class="dashboard-kpi-meta">+${formatMoney(lucroTotal)} em juros</p>
                        </div>
                        <div class="dashboard-kpi-icon dashboard-kpi-icon-purple"><i data-lucide="piggy-bank" class="w-5 h-5"></i></div>
                    </div>
                </article>

                <article class="dashboard-kpi card-enter">
                    <div class="dashboard-kpi-top">
                        <div>
                            <p class="dashboard-kpi-label">Ja recebido</p>
                            <h3 class="dashboard-kpi-value counter-reveal" data-counter-target="${totalRecebido}">${formatMoney(totalRecebido)}</h3>
                            <p class="dashboard-kpi-meta">${state.transacoes.length} transacoes</p>
                        </div>
                        <div class="dashboard-kpi-icon dashboard-kpi-icon-green"><i data-lucide="check-circle" class="w-5 h-5"></i></div>
                    </div>
                </article>
                
                <article class="dashboard-kpi dashboard-kpi-risk card-enter ${inadimplentes > 0 ? 'is-alert' : ''}">
                    <div class="dashboard-kpi-top">
                        <div>
                            <p class="dashboard-kpi-label">Inadimplencia</p>
                            <h3 class="dashboard-kpi-value">${inadimplentes}</h3>
                            <p class="dashboard-kpi-meta">${inadimplentes > 0 ? 'Acao urgente' : 'Tudo em dia'}</p>
                        </div>
                        <div class="dashboard-kpi-icon ${inadimplentes > 0 ? 'dashboard-kpi-icon-red' : 'dashboard-kpi-icon-muted'}"><i data-lucide="alert-octagon" class="w-5 h-5"></i></div>
                    </div>
                </article>
            </section>

            <!-- Analytics Row -->
            <section class="dashboard-analytics-grid">
                <!-- Gráfico Principal - Fluxo Semanal -->
                <div class="dashboard-panel dashboard-panel-wide">
                    <div class="dashboard-panel-header">
                        <div>
                            <h3>
                                <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
                                Fluxo dos Últimos 7 Dias
                            </h3>
                            <p>Entradas, saidas e ritmo da operacao.</p>
                        </div>
                        <div class="dashboard-chart-summary">
                            <span>Fluxo semanal</span>
                            <strong class="${fluxoSemana >= 0 ? 'text-emerald-300' : 'text-red-300'}">${formatMoney(fluxoSemana)}</strong>
                        </div>
                    </div>
                    <div class="dashboard-chart-legend">
                        <span><i class="legend-dot legend-dot-green"></i> Recebido</span>
                        <span><i class="legend-dot legend-dot-blue"></i> Emprestado</span>
                    </div>
                    <div class="dashboard-chart-wrap">
                        <canvas id="mainChart"></canvas>
                    </div>
                </div>

                <!-- Gráfico Pizza - Status dos Contratos -->
                <div class="dashboard-panel">
                    <div class="dashboard-panel-header compact">
                        <div>
                            <h3><i data-lucide="pie-chart" class="w-5 h-5"></i>Status Geral</h3>
                            <p>Qualidade da carteira ativa.</p>
                        </div>
                    </div>
                    <div class="dashboard-donut">
                        <div class="dashboard-donut-canvas">
                            <canvas id="pieChart"></canvas>
                        </div>
                        <div class="dashboard-donut-center">
                            <strong>${taxaAdimplencia}%</strong>
                            <span>Adimplencia</span>
                        </div>
                    </div>
                    <div class="dashboard-status-grid">
                        <div>
                            <span class="status-dot status-dot-green"></span>
                            <strong>${contratosAtivos - inadimplentes}</strong>
                            <small>Em dia</small>
                        </div>
                        <div>
                            <span class="status-dot status-dot-red"></span>
                            <strong>${inadimplentes}</strong>
                            <small>Criticos</small>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Operational Row -->
            <section class="dashboard-ops-grid">
                <div class="dashboard-panel dashboard-ops-panel">
                    <div class="dashboard-panel-header compact">
                        <div>
                            <h3><i data-lucide="shield-check" class="w-5 h-5"></i>Saude Operacional</h3>
                            <p>Leitura rapida de risco e estabilidade.</p>
                        </div>
                        <span class="dashboard-risk-pill ${inadimplentes > 0 ? 'is-alert' : 'is-stable'}">${riscoOperacional}</span>
                    </div>
                    <div class="dashboard-ops-meter">
                        <div>
                            <span>Adimplencia</span>
                            <strong>${taxaAdimplencia}%</strong>
                        </div>
                        <div class="ops-meter-track">
                            <span style="width:${Math.min(Math.max(taxaAdimplencia, 0), 100)}%"></span>
                        </div>
                    </div>
                    <div class="dashboard-ops-chips">
                        <span>${riscoDescricao}</span>
                        <span>${contratosAtivos} contratos ativos</span>
                        <span>${state.transacoes.length} transacoes</span>
                    </div>
                </div>

                <div class="dashboard-panel">
                    <div class="dashboard-panel-header compact">
                        <div>
                            <h3><i data-lucide="calculator" class="w-5 h-5"></i>Calculadora Rapida</h3>
                            <p>Simulacao simples de operacao.</p>
                        </div>
                    </div>
                    <div class="dashboard-calc-form">
                        <label>
                            <span>Valor</span>
                            <input type="number" id="calc-valor" placeholder="1000" class="input-premium" oninput="calcularRapido()">
                        </label>
                        <div class="dashboard-calc-split">
                            <label>
                                <span>Juros %</span>
                                <input type="number" id="calc-juros" value="30" class="input-premium" oninput="calcularRapido()">
                            </label>
                            <label>
                                <span>Parcelas</span>
                                <input type="number" id="calc-parcelas" value="1" min="1" class="input-premium" oninput="calcularRapido()">
                            </label>
                        </div>
                        <div class="dashboard-calc-result">
                            <span>Resultado</span>
                            <strong id="calc-resultado">R$ 0,00</strong>
                            <small id="calc-parcela-info">-</small>
                        </div>
                    </div>
                </div>

                <div class="dashboard-panel">
                    <div class="dashboard-panel-header compact">
                        <div>
                            <h3><i data-lucide="calendar-check" class="w-5 h-5"></i>Agenda de Hoje</h3>
                            <p>Vencimentos e cobrancas do dia.</p>
                        </div>
                    </div>
                    <div class="dashboard-agenda-list">
                        ${renderAgendaHoje()}
                    </div>
                </div>
            </section>

            <!-- Recent Activity -->
            <section class="dashboard-recent-grid">
                <!-- Atividade Recente -->
                <div class="dashboard-panel dashboard-panel-wide">
                    <div class="dashboard-panel-header">
                        <div>
                            <h3><i data-lucide="activity" class="w-5 h-5"></i>Atividade Recente</h3>
                            <p>Contratos ativos e movimentos que pedem acompanhamento.</p>
                        </div>
                        <button onclick="router('em_aberto')" class="dashboard-text-action">
                            Ver todos <i data-lucide="arrow-right" class="w-3 h-3"></i>
                        </button>
                    </div>
                    <div class="dashboard-loan-list">
                        ${renderActiveLoansList()}
                    </div>
                </div>
            </section>
        </div>
    `;

    // Inicializar gráficos + animações após renderizar
    setTimeout(() => {
        initMainChart(ultimos7Dias);
        initPieChart(contratosAtivos - inadimplentes, inadimplentes);
        animateDashCounters();
        hydrateDashboardRecibosCount();
    }, 100);
}

async function hydrateDashboardRecibosCount() {
    const el = document.getElementById('dashboard-recibos-count');
    if (!el || !window.db?.listarRecibosPendentes) return;
    try {
        const recibos = await window.db.listarRecibosPendentes();
        el.textContent = Array.isArray(recibos) ? String(recibos.length) : '0';
    } catch (_) {
        el.textContent = '0';
    }
}

// -- Animated Number Counters (requestAnimationFrame) --
function animateDashCounters() {
    const els = document.querySelectorAll('[data-counter-target]');
    els.forEach(el => {
        const target = parseFloat(el.dataset.counterTarget) || 0;
        if (target === 0) return;
        const duration = 900; // ms
        const start = performance.now();
        const update = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out expo curve
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            el.textContent = formatMoney(current);
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                el.textContent = formatMoney(target);
                el.classList.add('settled');
            }
        };
        requestAnimationFrame(update);
    });
    // Remove will-change from cards after animation
    setTimeout(() => {
        document.querySelectorAll('.card-enter').forEach(c => c.classList.add('settled'));
    }, 800);
}

function getSaudacao() {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
}

function calcularRapido() {
    const valor = parseFloat(document.getElementById('calc-valor')?.value) || 0;
    const juros = parseFloat(document.getElementById('calc-juros')?.value) || 0;
    const parcelas = parseInt(document.getElementById('calc-parcelas')?.value) || 1;

    const total = valor + (valor * juros / 100);
    const valorParcela = total / parcelas;

    document.getElementById('calc-resultado').textContent = formatMoney(total);
    document.getElementById('calc-parcela-info').textContent = parcelas > 1
        ? `${parcelas}x de ${formatMoney(valorParcela)}`
        : `Pagamento nico`;
}

function renderAgendaHoje() {
    const hoje = new Date().toISOString().split('T')[0];
    const vencemHoje = [];

    state.emprestimos.forEach(emp => {
        if (emp.statusGeral !== 'ativo') return;
        const cliente = state.clientes.find(c => c.id === emp.clienteId);
        emp.parcelas.forEach(p => {
            if (p.status === 'pendente' && p.vencimento === hoje) {
                vencemHoje.push({
                    cliente: cliente?.nome || 'Cliente',
                    valor: p.valorBase,
                    empId: emp.id
                });
            }
        });
    });

    if (vencemHoje.length === 0) {
        return `<div class="dashboard-empty-state">
            <div>
                <i data-lucide="check-circle" class="w-8 h-8 text-emerald-300 mx-auto mb-2"></i>
                <p>Nenhum vencimento hoje</p>
            </div>
        </div>`;
    }

    return vencemHoje.map(v => `
        <div class="dashboard-agenda-item" onclick="openPaymentModal('${encodeURIComponent(String(v.empId || ''))}')">
            <div class="dashboard-agenda-main">
                <div class="dashboard-agenda-avatar">
                    ${v.cliente.charAt(0)}
                </div>
                <span>${S(v.cliente)}</span>
            </div>
            <span class="dashboard-agenda-value">${formatMoney(v.valor)}</span>
        </div>
    `).join('');
}

function initMainChart(data) {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;

    if (mainChartInstance) mainChartInstance.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#7b8fa3' : '#64748b';

    mainChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [
                {
                    label: 'Recebido',
                    data: data.map(d => d.recebido),
                    backgroundColor: 'rgba(0, 255, 179, 0.78)',
                    borderRadius: 8,
                    borderSkipped: false
                },
                {
                    label: 'Emprestado',
                    data: data.map(d => d.emprestado),
                    backgroundColor: 'rgba(0, 212, 255, 0.7)',
                    borderRadius: 8,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { weight: '600' } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        callback: v => 'R$ ' + v.toLocaleString()
                    }
                }
            }
        }
    });
}

function initPieChart(emDia, criticos) {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;

    if (pieChartInstance) pieChartInstance.destroy();

    pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Em Dia', 'Críticos'],
            datasets: [{
                data: [emDia || 1, criticos],
                backgroundColor: ['rgba(0, 255, 179, 0.82)', 'rgba(251, 113, 133, 0.82)'],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderActiveLoansList() {
    const ativos = state.emprestimos.filter(e => e.statusGeral === 'ativo').slice(-5).reverse();
    if (ativos.length === 0) return '<div class="dashboard-empty-state">Nenhum contrato ativo no momento</div>';
    return ativos.map(emp => createLoanCard(emp)).join('');
}

function createLoanCard(emp) {
    const cliente = state.clientes.find(c => c.id === emp.clienteId);
    const parcelasPagas = emp.parcelas.filter(p => p.status === 'pago').length;
    const totalParcelas = emp.parcelas.length;
    const progresso = (parcelasPagas / totalParcelas) * 100;
    const tipoContrato = normalizeContractType(emp.tipo);
    // Label do tipo: usa os nomes configurados (config → Tipos de Crédito)
    const tipos = (typeof getCreditTipos === 'function') ? getCreditTipos() : [];
    const tipoCfg = tipos.find(t => t.key === tipoContrato);
    const tipoLabel = tipoCfg ? tipoCfg.label : tipoContrato;
    const descricaoTipo = tipoContrato === 'parcelado'
        ? `${tipoLabel}: ${parcelasPagas}/${totalParcelas} pagas`
        : (tipoContrato === 'cartao' ? `Contrato ${tipoLabel}` : `Empréstimo ${tipoLabel}`);

    let statusBadge = `<span class="badge bg-green-100 text-green-700">Em dia</span>`;
    const temAtraso = emp.parcelas.some(p => p.status === 'pendente' && getStatus(p.vencimento, null, emp.carenciaDias).code === 'atrasado');
    const temInadimplencia = emp.parcelas.some(p => p.status === 'pendente' && getStatus(p.vencimento, null, emp.carenciaDias).code === 'inadimplente');

    if (temInadimplencia) statusBadge = `<span class="badge bg-red-100 text-red-700">Inadimplente (>5d)</span>`;
    else if (temAtraso) statusBadge = `<span class="badge bg-orange-100 text-orange-700">Atrasado</span>`;

    if (emp.statusGeral === 'finalizado') statusBadge = `<span class="badge bg-gray-200 text-gray-600">Finalizado</span>`;

    const overrideBadge = emp.liberadoPor
        ? `<span class="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 ml-2 font-bold uppercase tracking-wide" title="Liberado por: ${emp.liberadoPor}">Auth: Gestor</span>`
        : '';

    const gestorBadge = emp.gestorResponsavel
        ? `<span class="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 ml-2 font-medium" title="Gestor responsável">Gestor: ${emp.gestorResponsavel}</span>`
        : '';

    return `
    <div class="dashboard-loan-card">
        <div class="dashboard-loan-main">
            <div class="dashboard-loan-avatar">
                ${cliente ? S(cliente.nome).charAt(0) : '?'}
            </div>
            <div>
                <p class="dashboard-loan-title">${cliente ? S(cliente.nome) : 'Cliente removido'} ${overrideBadge} ${gestorBadge}</p>
                <p class="dashboard-loan-subtitle">${descricaoTipo}</p>
            </div>
        </div>
        
        <div class="dashboard-loan-side">
            <div class="dashboard-loan-value">
                <span>Valor total</span>
                <strong>${formatMoney(emp.valorTotal)}</strong>
            </div>
            <div>
                ${statusBadge}
            </div>
            <button onclick="openPaymentModal('${encodeURIComponent(String(emp.id || ''))}')" class="dashboard-loan-button">
                Detalhes
            </button>
        </div>
        ${tipoContrato === 'parcelado' ? `
        <div class="dashboard-loan-progress md:hidden">
            <div style="width: ${progresso}%"></div>
        </div>
        ` : ''}
    </div>
    `;
}
