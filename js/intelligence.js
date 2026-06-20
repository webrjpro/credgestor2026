/**
 * intelligence.js
 * Central de Inteligência Financeira e Features Premium Offline
 * 
 * 1. Projeção Financeira (Forecast 30/60/90d)
 * 2. Metas & KPIs (Gamification)
 * 3. Simulador "E Se?" (What-If Scenarios)
 * 4. Auditoria Completa (Audit Log)
 * 5. Recibo PDF Profissional (jsPDF)
 * 6. Backup Automático Local
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. PROJEÇÃO FINANCEIRA (FORECAST)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderProjecao(content) {
    const hoje = parseLocalDate(getToday());
    let projecoes = { 30: 0, 60: 0, 90: 0 };
    let parcelasPrevistas = [];

    // Calcular parcelas futuras
    state.emprestimos.forEach(emp => {
        if (emp.statusGeral !== 'ativo') return;
        emp.parcelas.forEach(p => {
            if (p.status !== 'pendente') return;
            const venc = parseLocalDate(p.vencimento);
            const diffDays = Math.floor((venc - hoje) / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays <= 90) {
                if (diffDays <= 30) projecoes[30] += p.valorBase;
                if (diffDays > 30 && diffDays <= 60) projecoes[60] += p.valorBase;
                if (diffDays > 60 && diffDays <= 90) projecoes[90] += p.valorBase;

                parcelasPrevistas.push({
                    data: p.vencimento,
                    valor: p.valorBase,
                    clienteId: emp.clienteId
                });
            }
        });
    });

    // Taxa histórica de adimplência (para cenário realista)
    let totalPagas = 0; let totalAtrasadas = 0;
    state.emprestimos.forEach(e => {
        e.parcelas.forEach(p => {
            if (p.status === 'pago') totalPagas++;
            if (p.status === 'pendente' && getStatus(p.vencimento, null, emp.carenciaDias).code === 'inadimplente') totalAtrasadas++;
        });
    });
    const taxaRecebimento = totalPagas + totalAtrasadas === 0 ? 0.9 : totalPagas / (totalPagas + totalAtrasadas);

    const realista30 = projecoes[30] * taxaRecebimento;
    const realista60 = projecoes[60] * taxaRecebimento;
    const realista90 = projecoes[90] * taxaRecebimento;

    // Render HTML
    content.innerHTML = `
        <div class="space-y-6 fade-in">
            <div class="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 flex justify-between items-center rounded-2xl shadow-lg border border-cyan-500/30">
                <div>
                    <h3 class="text-2xl font-black text-white flex items-center gap-2">
                        <i data-lucide="trending-up" class="w-7 h-7"></i>
                        Projeção Financeira
                    </h3>
                    <p class="text-cyan-100/80 font-medium text-sm mt-1">Estimativa de fluxo de caixa futuro baseada em contratos ativos</p>
                </div>
                <div class="bg-white/10 p-3 rounded-xl border border-white/20 text-right">
                    <p class="text-[10px] text-cyan-200 uppercase font-bold tracking-wider mb-0.5">Taxa Histórica Adimplência</p>
                    <p class="text-2xl font-black text-white">${(taxaRecebimento * 100).toFixed(1)}%</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- 30 Dias -->
                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 stagger-1">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="p-2.5 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600">
                            <i data-lucide="calendar" class="w-5 h-5"></i>
                        </div>
                        <h4 class="font-bold text-slate-700 dark:text-slate-200">Próximos 30 dias</h4>
                    </div>
                    <p class="text-[10px] text-slate-500 font-bold uppercase mb-1">Cenário Otimista</p>
                    <p class="text-2xl font-black text-slate-800 dark:text-white mb-3" id="proj-30-opt">R$ 0</p>
                    
                    <div class="p-3 bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border border-cyan-100 dark:border-cyan-800/50">
                        <p class="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold uppercase flex items-center gap-1 mb-1">
                            <i data-lucide="target" class="w-3 h-3"></i> Cenário Realista (${(taxaRecebimento * 100).toFixed(0)}%)
                        </p>
                        <p class="text-lg font-bold text-cyan-700 dark:text-cyan-300" id="proj-30-real">R$ 0</p>
                    </div>
                </div>

                <!-- 60 Dias -->
                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 stagger-2">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                            <i data-lucide="calendar-days" class="w-5 h-5"></i>
                        </div>
                        <h4 class="font-bold text-slate-700 dark:text-slate-200">31 a 60 dias</h4>
                    </div>
                    <p class="text-[10px] text-slate-500 font-bold uppercase mb-1">Cenário Otimista</p>
                    <p class="text-2xl font-black text-slate-800 dark:text-white mb-3" id="proj-60-opt">R$ 0</p>
                    
                    <div class="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50">
                        <p class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase flex items-center gap-1 mb-1">
                            <i data-lucide="target" class="w-3 h-3"></i> Cenário Realista (${(taxaRecebimento * 100).toFixed(0)}%)
                        </p>
                        <p class="text-lg font-bold text-blue-700 dark:text-blue-300" id="proj-60-real">R$ 0</p>
                    </div>
                </div>

                <!-- 90 Dias -->
                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 stagger-3">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
                            <i data-lucide="calendar-range" class="w-5 h-5"></i>
                        </div>
                        <h4 class="font-bold text-slate-700 dark:text-slate-200">61 a 90 dias</h4>
                    </div>
                    <p class="text-[10px] text-slate-500 font-bold uppercase mb-1">Cenário Otimista</p>
                    <p class="text-2xl font-black text-slate-800 dark:text-white mb-3" id="proj-90-opt">R$ 0</p>
                    
                    <div class="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                        <p class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase flex items-center gap-1 mb-1">
                            <i data-lucide="target" class="w-3 h-3"></i> Cenário Realista (${(taxaRecebimento * 100).toFixed(0)}%)
                        </p>
                        <p class="text-lg font-bold text-indigo-700 dark:text-indigo-300" id="proj-90-real">R$ 0</p>
                    </div>
                </div>
            </div>

            <!-- Gráfico Line Chart -->
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 stagger-4">
                <h4 class="font-bold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
                    <i data-lucide="line-chart" class="w-5 h-5 text-cyan-500"></i> Evolução de Recebimentos Futuros
                </h4>
                <div class="h-[300px] w-full relative">
                    <canvas id="forecastChart"></canvas>
                </div>
            </div>
        </div>
    `;

    refreshIcons();

    // Animators
    requestAnimationFrame(() => {
        animateNumber(document.getElementById('proj-30-opt'), projecoes[30], 1000);
        animateNumber(document.getElementById('proj-60-opt'), projecoes[60], 1000);
        animateNumber(document.getElementById('proj-90-opt'), projecoes[90], 1000);

        animateNumber(document.getElementById('proj-30-real'), realista30, 1200);
        animateNumber(document.getElementById('proj-60-real'), realista60, 1200);
        animateNumber(document.getElementById('proj-90-real'), realista90, 1200);

        initForecastChart(projecoes, realista30, realista60, realista90);
    });
}

function initForecastChart(projecoes, r30, r60, r90) {
    const ctx = document.getElementById('forecastChart');
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Próximos 30 dias', '31 a 60 dias', '61 a 90 dias'],
            datasets: [
                {
                    label: 'Cenário Otimista (100%)',
                    data: [projecoes[30], projecoes[60], projecoes[90]],
                    borderColor: '#06b6d4', // cyan-500
                    backgroundColor: '#06b6d433', // cyan com alfa
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Cenário Realista (Histórico)',
                    data: [r30, r60, r90],
                    borderColor: '#f59e0b', // amber-500
                    borderWidth: 3,
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: textColor } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + formatMoney(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor } },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        callback: function (value) { return 'R$ ' + value.toLocaleString(); }
                    }
                }
            }
        }
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. METAS & KPIS (GAMIFICATION)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderMetas(content) {
    // Definir metas padrão mensal se não existir no banco
    const metaEmprestado = 50000;
    const metaRecebido = 40000;

    // Obter mês atual
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    let totalEmprestadoMes = 0;
    let totalRecebidoMes = 0;

    state.emprestimos.forEach(emp => {
        const empData = parseLocalDate(emp.dataInicio);
        if (empData.getMonth() === mesAtual && empData.getFullYear() === anoAtual) {
            totalEmprestadoMes += emp.valorOriginal;
        }
    });

    state.transacoes.forEach(t => {
        const tData = new Date(t.data);
        if (t.tipo === 'entrada' && tData.getMonth() === mesAtual && tData.getFullYear() === anoAtual) {
            totalRecebidoMes += t.valor;
        }
    });

    const progressoEmprestado = Math.min((totalEmprestadoMes / metaEmprestado) * 100, 100);
    const progressoRecebido = Math.min((totalRecebidoMes / metaRecebido) * 100, 100);

    const conquistas = [
        { id: 1, icon: 'medal', title: 'Primeiro Empréstimo', unlocked: state.emprestimos.length > 0 },
        { id: 2, icon: 'trophy', title: '10 Contratos', unlocked: state.emprestimos.length >= 10 },
        { id: 3, icon: 'crown', title: 'R$ 100k Recebidos', unlocked: state.caixa.totalEntradas >= 100000 },
        { id: 4, icon: 'shield-check', title: 'Zero Inadimplência', unlocked: getInadimplenciaRate() === 0 && state.emprestimos.length > 5 }
    ];

    let htmlConquistas = conquistas.map(c => `
        <div class="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center ${c.unlocked ? '' : 'opacity-50 grayscale'}">
            <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3 ${c.unlocked ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}">
                <i data-lucide="${c.icon}" class="w-6 h-6"></i>
            </div>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">
                ${c.title}
            </p>
            <p class="text-[9px] uppercase font-bold text-slate-400 mt-1">${c.unlocked ? 'Desbloqueado 🔓' : 'Bloqueado 🔒'}</p>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="space-y-6 fade-in">
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 p-6 flex justify-between items-center rounded-2xl shadow-lg border border-amber-400/30">
                <div>
                    <h3 class="text-2xl font-black text-white flex items-center gap-2">
                        <i data-lucide="target" class="w-7 h-7"></i>
                        Metas Mensais (Gamification)
                    </h3>
                    <p class="text-amber-100/80 font-medium text-sm mt-1">Acompanhe seu desempenho e desbloqueie conquistas</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Meta Emprestado -->
                <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 stagger-1">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <i data-lucide="hand-coins" class="w-5 h-5 text-emerald-500"></i>
                            Meta Empréstimos Realizados
                        </h4>
                        <span class="text-emerald-600 dark:text-emerald-400 font-black">${progressoEmprestado.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-4 mb-3 overflow-hidden">
                        <div class="bg-emerald-500 h-4 rounded-full transition-all duration-1000" style="width: ${progressoEmprestado}%" id="bar-emp"></div>
                    </div>
                    <div class="flex justify-between text-xs text-slate-500 font-medium">
                        <span id="txt-emp-atual">R$ 0</span>
                        <span>Meta: ${formatMoney(metaEmprestado)}</span>
                    </div>
                </div>

                <!-- Meta Recebido -->
                <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 stagger-2">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <i data-lucide="piggy-bank" class="w-5 h-5 text-blue-500"></i>
                            Meta Recebimentos
                        </h4>
                        <span class="text-blue-600 dark:text-blue-400 font-black">${progressoRecebido.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-4 mb-3 overflow-hidden">
                        <div class="bg-blue-500 h-4 rounded-full transition-all duration-1000" style="width: ${progressoRecebido}%" id="bar-rec"></div>
                    </div>
                    <div class="flex justify-between text-xs text-slate-500 font-medium">
                        <span id="txt-rec-atual">R$ 0</span>
                        <span>Meta: ${formatMoney(metaRecebido)}</span>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 stagger-3">
                <h4 class="font-bold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
                    <i data-lucide="award" class="w-5 h-5 text-amber-500"></i> Conquistas e Badges
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    ${htmlConquistas}
                </div>
            </div>
        </div>
    `;

    refreshIcons();

    // Animate bars
    requestAnimationFrame(() => {
        setTimeout(() => {
            animateNumber(document.getElementById('txt-emp-atual'), totalEmprestadoMes, 1000);
            animateNumber(document.getElementById('txt-rec-atual'), totalRecebidoMes, 1000);
        }, 100);
    });
}

function getInadimplenciaRate() {
    let pendentes = 0; let atrasados = 0;
    state.emprestimos.forEach(emp => {
        emp.parcelas.forEach(p => {
            if (p.status === 'pendente') {
                pendentes++;
                if (getStatus(p.vencimento, null, emp.carenciaDias).code === 'inadimplente') atrasados++;
            }
        });
    });
    return pendentes === 0 ? 0 : (atrasados / pendentes);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. SIMULADOR E-SE? (WHAT-IF)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function abrirSimulador() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4';
    overlay.style.animation = 'fadeIn 0.2s ease';

    // Gerar opções de clientes
    let optionsHtml = '<option value="">(Selecione um cliente para base histórico)</option>';
    const sorted = [...state.clientes].sort((a, b) => a.nome.localeCompare(b.nome));
    sorted.forEach(c => {
        const risk = analyzeRiskCached(c.id);
        const icon = risk.code === 'A' ? '🟢' : risk.code === 'B' ? '🟡' : '🔴';
        optionsHtml += `<option value="${S(c.id)}">${S(c.nome)} (${icon} Score ${risk.score})</option>`;
    });

    overlay.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden scale-in border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div class="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600">
                <div>
                    <h3 class="font-black text-white flex items-center gap-2 text-lg">
                        <i data-lucide="flask-conical" class="w-5 h-5"></i> Simulador de Cenários "E Se?"
                    </h3>
                    <p class="text-[11px] text-purple-100 font-medium opacity-80 mt-0.5">Teste o impacto no seu caixa antes de emprestar</p>
                </div>
                <button onclick="this.closest('.fixed').remove()" class="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto" style="scrollbar-width:thin">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <h4 class="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                <i data-lucide="settings-2" class="w-4 h-4"></i> Parâmetros
                            </h4>
                            
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Caixa Atual</label>
                                    <input type="text" readonly value="${formatMoney(state.caixa.saldo)}" class="w-full input-premium rounded-lg p-2 text-sm bg-slate-100 dark:bg-slate-700 cursor-not-allowed text-slate-500">
                                </div>
                                
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Cliente Base</label>
                                    <select id="sim-cliente" class="w-full input-premium rounded-lg p-2 text-sm" onchange="runSimulation()">
                                        ${optionsHtml}
                                    </select>
                                </div>

                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Valor do Novo Empréstimo</label>
                                    <input type="number" id="sim-valor" value="1000" class="w-full input-premium rounded-lg p-2 text-sm" oninput="runSimulation()">
                                </div>
                                
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Taxa Juros (%)</label>
                                        <input type="number" id="sim-juros" value="20" class="w-full input-premium rounded-lg p-2 text-sm" oninput="runSimulation()">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Parcelas</label>
                                        <input type="number" id="sim-parcelas" value="3" class="w-full input-premium rounded-lg p-2 text-sm" oninput="runSimulation()">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800/30 h-full flex flex-col justify-center">
                            <h4 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
                                <i data-lucide="bar-chart" class="w-4 h-4"></i> Impacto Projetado
                            </h4>
                            
                            <div class="space-y-4">
                                <div class="text-center">
                                    <p class="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Novo Saldo Caixa</p>
                                    <p class="text-2xl font-black text-slate-800 dark:text-slate-200" id="sim-res-caixa">R$ 0</p>
                                </div>
                                
                                <div class="h-px bg-slate-200 dark:bg-slate-700 w-full"></div>
                                
                                <div class="grid grid-cols-2 gap-4 text-center">
                                    <div>
                                        <p class="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Lucro Bruto</p>
                                        <p class="text-lg font-bold text-emerald-600" id="sim-res-lucro">R$ 0</p>
                                    </div>
                                    <div>
                                        <p class="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Risco Atribuído</p>
                                        <p class="text-lg font-bold" id="sim-res-risco">-</p>
                                    </div>
                                </div>
                                
                                <div id="sim-alert" class="hidden mt-2 p-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold text-center border border-red-200">
                                    CAIXA NEGATIVO!
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    refreshIcons();

    // Attach runSimulation globally for inline handlers
    window.runSimulation = () => {
        const valor = parseFloat(document.getElementById('sim-valor').value) || 0;
        const juros = parseFloat(document.getElementById('sim-juros').value) || 0;
        const nParcelas = parseInt(document.getElementById('sim-parcelas').value) || 1;
        const clienteId = document.getElementById('sim-cliente').value;
        const alertEl = document.getElementById('sim-alert');

        // Calcular novo caixa
        const novoCaixa = state.caixa.saldo - valor;
        const caixaEl = document.getElementById('sim-res-caixa');
        caixaEl.textContent = formatMoney(novoCaixa);

        if (novoCaixa < 0) {
            caixaEl.className = 'text-2xl font-black text-red-600';
            alertEl.classList.remove('hidden');
        } else {
            caixaEl.className = 'text-2xl font-black text-slate-800 dark:text-slate-200';
            alertEl.classList.add('hidden');
        }

        // Calcular Lucro
        const lucro = valor * (juros / 100);
        document.getElementById('sim-res-lucro').textContent = formatMoney(lucro);

        // Analisar Risco
        const riscoEl = document.getElementById('sim-res-risco');
        if (clienteId) {
            const risk = analyzeRiskCached(clienteId);
            let riskMultiplier = risk.code === 'A' ? 1 : risk.code === 'B' ? 1.5 : 2.5; // aumenta juros recomendado se risco alto

            riscoEl.innerHTML = `<span class="${risk.code === 'C' ? 'text-red-600' : risk.code === 'B' ? 'text-amber-500' : 'text-emerald-500'}">${risk.code} (${risk.score})</span>`;

            // Recomendar ajuste
            if (risk.code === 'C' && novoCaixa > 0) {
                alertEl.textContent = 'ALTO RISCO! Considere aumento de taxa ou rejeição.';
                alertEl.className = 'mt-2 p-2 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold text-center border border-orange-200 block';
            }
        } else {
            riscoEl.textContent = 'Indeterminado';
        }
    };

    setTimeout(() => window.runSimulation(), 100);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. AUDITORIA COMPLETA (AUDIT LOG)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function logAction(action, details) {
    console.info('[audit-ui]', action, details || '');
}

// Capturar logins na UI
document.addEventListener('submit', (e) => {
    if (e.target.id === 'auth-form') logAction('LOGIN', 'Usuário logou no sistema.');
});

function _auditActionClass(action) {
    const value = String(action || '').toUpperCase();
    if (value.includes('DELETE') || value.includes('RESET') || value.includes('ESTORNAR')) {
        return 'text-red-600 bg-red-50 dark:bg-red-900/20';
    }
    if (value.includes('LOGIN') || value.includes('AUTH')) {
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    }
    if (value.includes('CREATE') || value.includes('PAGAMENTO') || value.includes('ENTREGAR')) {
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
    }
    return 'text-slate-700 bg-slate-100 dark:bg-slate-700 dark:text-slate-300';
}

function _auditDetailsText(details) {
    if (details === null || details === undefined) return '';
    if (typeof details === 'string') return details;
    try { return JSON.stringify(details); } catch (_) { return String(details); }
}

function renderAuditoria(content) {
    content.innerHTML = `
        <div class="space-y-6 fade-in">
            <div class="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg border border-slate-700">
                <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h3 class="text-2xl font-black text-white flex items-center gap-2">
                            <i data-lucide="scroll-text" class="w-7 h-7"></i>
                            Registro de Auditoria
                        </h3>
                        <p class="text-slate-400 font-medium text-sm mt-1">Consulta direta ao audit_log do SQLite local.</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-2 w-full lg:w-auto">
                        <input id="audit-search" type="text" placeholder="Buscar ação, usuário, IP ou detalhe"
                            class="input-premium rounded-xl px-3 py-2 text-sm min-w-0">
                        <input id="audit-action" type="text" placeholder="Ação"
                            class="input-premium rounded-xl px-3 py-2 text-sm min-w-0">
                        <button onclick="carregarAuditoria(0)"
                            class="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 flex items-center justify-center gap-2">
                            <i data-lucide="search" class="w-4 h-4"></i> Consultar
                        </button>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                            <tr>
                                <th class="px-6 py-4">Data/Hora</th>
                                <th class="px-6 py-4">Usuário</th>
                                <th class="px-6 py-4">Ação</th>
                                <th class="px-6 py-4">IP</th>
                                <th class="px-6 py-4 w-1/2">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody id="audit-table-body" class="divide-y divide-slate-100 dark:divide-slate-700/50">
                            <tr><td colspan="5" class="px-6 py-10 text-center text-slate-400">Carregando logs...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-slate-700">
                    <p id="audit-pagination-info" class="text-xs text-slate-500">-</p>
                    <div class="flex gap-2">
                        <button id="audit-prev" onclick="carregarAuditoria(Math.max(0, (window._auditOffset || 0) - 100))"
                            class="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40">
                            Anterior
                        </button>
                        <button id="audit-next" onclick="carregarAuditoria((window._auditOffset || 0) + 100)"
                            class="px-3 py-2 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40">
                            Proxima
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    refreshIcons();
    carregarAuditoria(0);
}

window.carregarAuditoria = async function carregarAuditoria(offset = 0) {
    const tbody = document.getElementById('audit-table-body');
    const info = document.getElementById('audit-pagination-info');
    const prev = document.getElementById('audit-prev');
    const next = document.getElementById('audit-next');
    if (!tbody) return;

    const limit = 100;
    window._auditOffset = Math.max(0, Number(offset) || 0);
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-400">Carregando logs...</td></tr>`;

    try {
        let logs = [];
        let total = 0;
        let hasMore = false;
        if (window.db && typeof window.db.getAuditLogs === 'function') {
            const data = await window.db.getAuditLogs({
                limit,
                offset: window._auditOffset,
                search: document.getElementById('audit-search')?.value || '',
                action: document.getElementById('audit-action')?.value || ''
            });
            if (data?.error) throw new Error(data.error);
            logs = data.logs || [];
            total = data.pagination?.total || logs.length;
            hasMore = !!data.pagination?.hasMore;
        }

        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="5">
                    <div class="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                        <i data-lucide="shield-alert" class="w-12 h-12 mb-3 text-slate-300"></i>
                        <p class="font-bold">Nenhum log encontrado.</p>
                    </div>
                </td></tr>`;
        } else {
            tbody.innerHTML = logs.map(log => {
                const d = new Date(log.timestamp || log.time || Date.now());
                const ts = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
                const details = _auditDetailsText(log.details);
                return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td class="px-6 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">${S(ts)}</td>
                        <td class="px-6 py-3 font-semibold text-slate-700 dark:text-slate-300">${S(log.userName || log.userEmail || 'Sistema')}</td>
                        <td class="px-6 py-3">
                            <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${_auditActionClass(log.action)}">
                                ${S(log.action)}
                            </span>
                        </td>
                        <td class="px-6 py-3 text-xs text-slate-400 font-mono">${S(log.ip || '-')}</td>
                        <td class="px-6 py-3 text-slate-600 dark:text-slate-400 text-xs max-w-md truncate" title="${S(details)}">${S(details)}</td>
                    </tr>`;
            }).join('');
        }

        if (info) {
            const start = total === 0 ? 0 : window._auditOffset + 1;
            const end = Math.min(total, window._auditOffset + logs.length);
            info.textContent = `${start}-${end} de ${total} log(s)`;
        }
        if (prev) prev.disabled = window._auditOffset <= 0;
        if (next) next.disabled = !hasMore;
        refreshIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-red-500">Erro ao carregar auditoria: ${S(err.message)}</td></tr>`;
        if (info) info.textContent = 'Falha na consulta';
        if (prev) prev.disabled = true;
        if (next) next.disabled = true;
    }
};

window.limparAuditoria = () => {
    showToast('A auditoria fica preservada no SQLite. Use a retenção automática em Configurações.', 'info');
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. RECIBO PDF PROFISSIONAL (jsPDF) + QR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.gerarReciboPDF = async function (empId, parcelaNum) {
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
        showToast('Falha: jsPDF não carregado na engine. Certifique-se de internet ou arquivo local.', 'error');
        return;
    }

    // Suportar tanto o global jspdf quanto window.jspdf
    const { jsPDF } = window.jspdf || jspdf;

    const emp = state.emprestimos.find(e => e.id === empId);
    if (!emp) return showToast('Empréstimo não encontrado.', 'error');

    const cliente = getClienteById(emp.clienteId);
    if (!cliente) return showToast('Cliente não encontrado.', 'error');

    const parcela = emp.parcelas.find(p => p.numero === Number(parcelaNum));
    if (!parcela) return showToast('Parcela não encontrada.', 'error');

    const pgData = (parcela.pagamentos && parcela.pagamentos.length > 0) ? parcela.pagamentos[0].data : getToday();
    const pgValor = parcela.valorPago || 0;
    const empresaNome = state.config.empresaNome || "CredGestor - Gestao de Credito";
    const hash = btoa(emp.id + parcela.numero + pgValor).substring(0, 25).toUpperCase();
    const printCfg = getPrintConfig();

    if (printCfg.thermal) {
        const W = printCfg.widthMm;
        const doc = new jsPDF({ unit: 'mm', format: [W, 170] });
        const pad = W <= 58 ? 3 : 4;
        let y = 7;

        doc.setFont('helvetica', 'bold').setFontSize(W <= 58 ? 9 : 10);
        doc.text(empresaNome.slice(0, 32), W / 2, y, { align: 'center' });
        y += 5;
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text('RECIBO DE PAGAMENTO', W / 2, y, { align: 'center' });
        y += 4;
        doc.line(pad, y, W - pad, y);
        y += 6;

        const row = (label, value, bold = false) => {
            doc.setFont('helvetica', 'bold').setFontSize(7);
            doc.text(String(label).toUpperCase(), pad, y);
            y += 3.5;
            doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 10 : 8);
            const lines = doc.splitTextToSize(String(value || '-'), W - pad * 2);
            doc.text(lines, pad, y);
            y += lines.length * (bold ? 4.5 : 3.8) + 2;
        };

        row('Cliente', `${cliente.nome} ${cliente.cpf ? '(' + cliente.cpf + ')' : ''}`);
        row('Contrato', emp.id.substring(0, 12).toUpperCase());
        row('Parcela', `${parcela.numero} de ${emp.parcelas.length}`);
        row('Vencimento', formatDate(parcela.vencimento));
        row('Pagamento', formatDate(pgData.split('T')[0]));
        row('Valor recebido', formatMoney(pgValor), true);

        doc.line(pad, y, W - pad, y);
        y += 5;
        doc.setFont('courier', 'normal').setFontSize(6.5);
        doc.text(doc.splitTextToSize(`Autenticacao: ${hash}`, W - pad * 2), pad, y);
        y += 10;
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(getGestorName(), W / 2, y, { align: 'center' });
        y += 3;
        doc.text('Operador responsavel', W / 2, y, { align: 'center' });

        const fileName = `Recibo_Termico_${emp.id.substring(0, 6)}_${parcela.numero}.pdf`;
        doc.save(fileName);
        showToast("Recibo térmico gerado!", "success");
        logAction('PDF_GERADO', `Download de recibo térmico da parcela ${parcela.numero} (Contrato ${emp.id.substring(0, 5)})`);
        return;
    }

    const doc = new jsPDF();

    // Montar Header Profissional
    doc.setFillColor(6, 182, 212); // cyan-500
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE PAGAMENTO", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(empresaNome, 105, 30, { align: "center" });

    // Informações da Parcela
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO PAGAMENTO", 20, 60);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 65, 190, 65);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    doc.text(`Recebemos de: ${cliente.nome} (${cliente.cpf || 'Sem CPF'})`, 20, 80);
    doc.text(`Referente ao Contrato: ${emp.id.substring(0, 8).toUpperCase()}`, 20, 90);
    doc.text(`Parcela: ${parcela.numero} de ${emp.parcelas.length}`, 20, 100);
    doc.text(`Data de Vencimento: ${formatDate(parcela.vencimento)}`, 20, 110);
    doc.text(`Data do Pagamento: ${formatDate(pgData.split('T')[0])}`, 20, 120);

    // Bloco de Valor
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 130, 170, 30, 'F');

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("VALOR RECEBIDO:", 30, 148);

    doc.setTextColor(16, 185, 129); // emerald-500
    doc.setFontSize(20);
    doc.text(formatMoney(pgValor), 100, 150);

    // Autenticação Hash/Assinatura Fake
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    doc.text(`Autenticação Digital: ${hash}`, 20, 180);

    // Assinatura Gestor
    doc.setDrawColor(50, 50, 50);
    doc.line(100, 220, 190, 220);
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(getGestorName(), 145, 228, { align: "center" });

    // Download
    const fileName = `Recibo_Contrato${emp.id.substring(0, 6)}_${parcela.numero}.pdf`;
    doc.save(fileName);
    showToast("Recibo gerado e baixado!", "success");
    logAction('PDF_GERADO', `Download de recibo da parcela ${parcela.numero} (Contrato ${emp.id.substring(0, 5)})`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. BACKUP AUTOMÁTICO ROTATIVO LOCAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Chama o main process de hora em hora caso rodando no Electron
if (window.electronAPI && typeof window.electronAPI.autoBackup === 'function') {
    // A cada 2 horas (1000ms * 60s * 60m * 2h)
    setInterval(() => {
        window.electronAPI.autoBackup(state).then(res => {
            if (res.success) {
                console.log('Backup automático realizado com sucesso.');
                logAction('AUTO_BACKUP', 'O sistema realizou um backup automático rotativo.');
            }
        });
    }, 1000 * 60 * 60 * 2);

    // Botão de Forçar Backup
    window.forcarBackupLocal = async () => {
        showToast('Iniciando backup forçado...', 'info');
        const res = await window.electronAPI.autoBackup(state);
        if (res.success) {
            showToast('Backup concluído com sucesso em ' + res.path, 'success');
            logAction('MANUAL_BACKUP', 'O usuário forçou o backup seguro no disco.');
        } else {
            showToast('Erro no backup.', 'error');
        }
    };
} else {
    // Fallback Web: Se não usar electron, apenas salvar em arquivo txt periodicamente se necessário
    window.forcarBackupLocal = () => {
        const json = JSON.stringify(state);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CredGestor_Backup_${getToday()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Backup Web baixado.', 'success');
        logAction('MANUAL_BACKUP', 'O usuário fez download manual em JSON.');
    };
}

// Global scope expose for the PDF button injection inside Views.js
window.injectReceiptButton = function (html, empId, parcelaNum) {
    if (html.includes('Status: PAGO')) {
        // Encontra o fim da div buttons e adiciona
        return html + `
            <div class="mt-4 flex justify-end">
               <button type="button" onclick="gerarReciboPDF('${empId}', ${parcelaNum})" class="btn-premium px-4 py-2 rounded-xl text-sm text-cyan-700 bg-cyan-100 hover:bg-cyan-200 border border-cyan-200 flex items-center gap-2 font-bold shadow-sm transition-all">
                  <i data-lucide="file-check-2" class="w-4 h-4"></i>
                  Gerar Recibo PDF
               </button>
            </div>
        `;
    }
    return html;
};
