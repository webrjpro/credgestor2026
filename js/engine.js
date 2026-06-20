// UTILITY: Mapa global de clientes por ID (elimina find() O(n))
let _clienteMap = new Map();
let _clienteMapVersion = -1;

function getClienteMap() {
    const v = (state.clientes || []).length;
    if (_clienteMapVersion !== v) {
        _clienteMap = new Map();
        for (const c of state.clientes) _clienteMap.set(c.id, c);
        _clienteMapVersion = v;
    }
    return _clienteMap;
}

function getClienteById(id) {
    return getClienteMap().get(id);
}

// Cache de cobranças do dia (TTL 30s, evita re-varredura a cada navegação)
let _cobrancasCache = null;
let _cobrancasCacheTime = 0;
const _COBRANCAS_TTL = 30000; // 30 segundos

function invalidateCobrancasCache() {
    _cobrancasCache = null;
    _cobrancasCacheTime = 0;
}

// SEÇÃO 4 — ANÁLISE DE RISCO / AI SCORE (0-1000)
// Calcula score com base em 5 eixos:
//   1. Estabilidade (idade do cliente)
//   2. Recorrência (quantidade de empréstimos)
//   3. Pontualidade (% de parcelas pagas sem multa)
//   4. Comprometimento (% do limite em uso)
//   5. Volume (total emprestado vs limite)
// Também detecta "Vício de Rolagem" (empréstimos consecutivos < 30 dias).
// O radar chart na modal "Analista AI" usa esses dados.
function calculateAge(dob) {
    if (!dob) return 0;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

function analyzeRisk(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    const emprestimos = state.emprestimos.filter(e => e.clienteId === clienteId);
    const age = calculateAge(cliente.dataNascimento);
    let badges = [];
    let radarData = { pontualidade: 50, volume: 50, estabilidade: 50, recorrencia: 50, comprometimento: 50 };
    let vicioScore = 0;

    // 1. Estabilidade (Idade)
    if (age < 18) { radarData.estabilidade = 0; badges.push({ t: "Menor de Idade", c: "bg-red-200 text-red-800" }); }
    else if (age < 23) { radarData.estabilidade = 40; badges.push({ t: "Jovem / Risco", c: "bg-orange-100 text-orange-600" }); }
    else radarData.estabilidade = 90;

    // 2. Vício (Rolagem) e Recorrência
    emprestimos.sort((a, b) => new Date(a.dataInicio) - new Date(b.dataInicio));
    for (let i = 1; i < emprestimos.length; i++) {
        const atual = new Date(emprestimos[i].dataInicio);
        const anterior = new Date(emprestimos[i - 1].dataInicio);
        const diffDias = (atual - anterior) / (1000 * 3600 * 24);
        if (diffDias < 30) vicioScore += 20; // Pegou outro muito rápido
    }
    if (vicioScore > 0) badges.push({ t: "Vício: Rolagem", c: "bg-red-100 text-red-700" });
    radarData.recorrencia = Math.min(100, emprestimos.length * 10);

    // 3. Pontualidade
    let totalAtrasos = 0;
    let parcelasPagas = 0;
    emprestimos.forEach(e => {
        e.parcelas.forEach(p => {
            if (p.status === 'pago') {
                parcelasPagas++;
                if (p.multaPaga > 0) totalAtrasos++;
            }
        });
    });
    if (parcelasPagas > 0) {
        radarData.pontualidade = Math.max(0, 100 - ((totalAtrasos / parcelasPagas) * 100));
    }

    // 4. Comprometimento
    const emUso = getClientUsedCredit(clienteId);
    const pctUso = cliente.limite > 0 ? (emUso / cliente.limite) * 100 : 0;
    radarData.comprometimento = pctUso;
    if (pctUso > 90) badges.push({ t: "Alavancado", c: "bg-red-100 text-red-600" });
    else if (pctUso < 30) badges.push({ t: "Margem Alta", c: "bg-green-100 text-green-600" });

    // 5. Volume (baseado no total emprestado vs limite)
    const totalEmprestado = emprestimos.reduce((sum, e) => sum + (e.valorOriginal || 0), 0);
    if (cliente.limite > 0) {
        radarData.volume = Math.min(100, (totalEmprestado / cliente.limite) * 100);
    } else {
        radarData.volume = emprestimos.length > 0 ? 70 : 0;
    }

    // Score Final — usa scoreCredito persistido como base
    const baseScore = (cliente.scoreCredito !== undefined && cliente.scoreCredito !== null) ? cliente.scoreCredito : 500;
    let score = baseScore;
    // Ajustes do AI (menores, pois o scoreCredito já carrega o histórico)
    score += Math.round((radarData.pontualidade - 50) * 0.5); // pontualidade acima/abaixo da média
    score -= Math.round(vicioScore * 1.5); // vício de rolagem
    if (radarData.estabilidade < 40) score -= 30; // jovem/risco
    score = Math.max(0, Math.min(1000, score));

    return { score, badges, radarData, vicioScore, age };
}

var _currentAnalystClientId = null;

function openAnalystModal(id) {
    _currentAnalystClientId = id;
    const c = state.clientes.find(x => x.id === id);
    const data = analyzeRisk(id);

    document.getElementById('ai-nome').innerText = c.nome;
    // Foto do cliente
    const fotoImg = document.getElementById('ai-foto-img');
    const fotoLetter = document.getElementById('ai-foto-letter');
    if (c.foto) {
        fotoImg.src = c.foto;
        fotoImg.classList.remove('hidden');
        fotoLetter.classList.add('hidden');
    } else {
        fotoImg.classList.add('hidden');
        fotoLetter.classList.remove('hidden');
        fotoLetter.innerText = c.nome.charAt(0);
    }
    document.getElementById('ai-idade').innerText = data.age > 0 ? `${data.age} anos` : 'N/A';
    document.getElementById('ai-score').innerText = Math.round(data.score);
    document.getElementById('ai-score-bar').style.width = (data.score / 10) + '%';
    document.getElementById('ai-score-bar').className = `h-full rounded-full ${data.score > 700 ? 'bg-emerald-500' : (data.score > 400 ? 'bg-yellow-500' : 'bg-red-500')}`;

    const badgeArea = document.getElementById('ai-badges');
    badgeArea.innerHTML = '';
    data.badges.forEach(b => {
        badgeArea.innerHTML += `<span class="badge ${b.c}">${b.t}</span>`;
    });

    const rec = document.getElementById('ai-recommendation');
    if (data.score > 700) { rec.innerText = "APROVAÇÃO RECOMENDADA"; rec.className = "p-3 rounded-xl text-center font-bold text-sm bg-emerald-100 text-emerald-700"; }
    else if (data.score > 400) { rec.innerText = "CAUTELA / GARANTIA"; rec.className = "p-3 rounded-xl text-center font-bold text-sm bg-yellow-100 text-yellow-700"; }
    else { rec.innerText = "NEGAR CRÉDITO"; rec.className = "p-3 rounded-xl text-center font-bold text-sm bg-red-100 text-red-700"; }

    document.getElementById('val-vicio').innerText = data.vicioScore + '%';
    document.getElementById('bar-vicio').style.width = Math.min(100, data.vicioScore) + '%';
    document.getElementById('val-comprometimento').innerText = Math.round(data.radarData.comprometimento) + '%';
    document.getElementById('bar-comprometimento').style.width = Math.min(100, data.radarData.comprometimento) + '%';

    // Chart.js
    if (riskChartInstance) riskChartInstance.destroy();
    const ctx = document.getElementById('riskChart').getContext('2d');
    riskChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Estabilidade', 'Recorrência', 'Pagamentos', 'Baixo Risco', 'Volume'],
            datasets: [{
                label: 'Perfil',
                data: [data.radarData.estabilidade, data.radarData.recorrencia, data.radarData.pontualidade, 100 - data.radarData.comprometimento, data.radarData.volume],
                backgroundColor: 'rgba(34, 197, 94, 0.2)', // Emerald 500 com opacidade
                borderColor: '#22c55e', // Emerald 500
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#22c55e',
            }]
        },
        options: { scales: { r: { beginAtZero: true, max: 100, ticks: { display: false } } }, plugins: { legend: { display: false } } }
    });

    document.getElementById('modal-analista').showModal();
}

// SEÇÃO 5 — BACKUP LOCAL
async function abrirModalBackupLocal() {
    const modal = document.getElementById('modal-backup-local');
    if (!modal) return;
    modal.showModal();

    const statusArea = document.getElementById('backup-status-area');
    if (statusArea) {
        statusArea.innerHTML = `<span class="text-slate-700 font-bold flex items-center justify-center gap-2"><i data-lucide="hard-drive" class="w-4 h-4"></i> Modo offline: backups fisicos e JSON somente locais</span>`;
        statusArea.className = "mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-center";
    }
    const chk = document.getElementById('backup-fisico-ativo');
    const dir = document.getElementById('backup-physical-dir');
    const ret = document.getElementById('backup-retencao');
    if (chk) {
        const ativo = String(state.config?.backupFisicoAtivo ?? '1').toLowerCase();
        chk.checked = !(ativo === '0' || ativo === 'false');
    }
    if (dir) dir.value = state.config?.backupFisicoDiretorio || '';
    if (ret) ret.value = String(Math.min(200, Math.max(1, Number.parseInt(state.config?.backupFisicoRetencao || '20', 10) || 20)));
    refreshIcons();
}

async function escolherDiretorioBackupFisico() {
    if (!window.electronAPI?.chooseBackupDirectory) {
        showToast('Seleção de pasta disponível apenas no aplicativo desktop.', 'error');
        return;
    }
    const result = await window.electronAPI.chooseBackupDirectory();
    if (result?.canceled) return;
    if (!result?.success) {
        showToast('Erro ao escolher pasta: ' + (result?.error || 'falha desconhecida'), 'error');
        return;
    }
    const dir = document.getElementById('backup-physical-dir');
    if (dir) dir.value = result.directory || '';
}

async function salvarConfigBackupFisico() {
    if (!state.config) state.config = {};
    const chk = document.getElementById('backup-fisico-ativo');
    const dir = document.getElementById('backup-physical-dir');
    const ret = document.getElementById('backup-retencao');
    state.config.backupFisicoAtivo = chk && chk.checked ? '1' : '0';
    state.config.backupFisicoDiretorio = (dir?.value || '').trim();
    state.config.backupFisicoRetencao = String(Math.min(200, Math.max(1, Number.parseInt(ret?.value || '20', 10) || 20)));
    const result = await persistConfig();
    if (result?.success) showToast('Configuração de backup físico salva!');
}

async function forcarBackupFisico() {
    if (!window.electronAPI?.autoBackup) {
        showToast('Backup físico disponível apenas no aplicativo desktop.', 'error');
        return;
    }
    await salvarConfigBackupFisico();
    const result = await window.electronAPI.autoBackup(state);
    if (result?.success) {
        showToast('Backup físico salvo em: ' + (result.path || result.filePath));
    } else if (result?.skipped) {
        showToast('Backup físico não executado: ' + (result.reason || 'desativado'), 'warning');
    } else {
        showToast('Erro no backup físico: ' + (result?.error || 'falha desconhecida'), 'error');
    }
}

async function resetData() {
    return resetTotal();
}

function pedirConfirmacaoResetTotal() {
    return new Promise((resolve) => {
        const overlay = document.createElement('dialog');
        overlay.className = 'reset-confirm-dialog';
        overlay.innerHTML = `
            <div class="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-950 text-slate-100 shadow-2xl">
                <div class="p-5 border-b border-red-500/20">
                    <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-300">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-base font-black text-red-200">Resetar dados locais</h3>
                            <p class="text-xs text-slate-400 mt-1 leading-relaxed">
                                Apaga clientes, contratos, transacoes, caixa, recibos, arquivos e logs locais.
                                O login do gestor fica preservado.
                            </p>
                        </div>
                    </div>
                </div>
                <form class="p-5 space-y-4">
                    <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-200">
                        Acao irreversivel. Digite RESETAR para confirmar.
                    </div>
                    <div>
                        <label class="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Confirmacao</label>
                        <input id="reset-confirm-input" class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm font-black text-slate-100 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20" autocomplete="off" placeholder="RESETAR">
                        <p id="reset-confirm-error" class="hidden mt-2 text-xs font-bold text-red-300">Digite RESETAR exatamente como indicado.</p>
                    </div>
                    <div class="flex gap-3">
                        <button type="button" data-action="cancel" class="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-700 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" class="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 transition-colors">
                            Resetar
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);
        try {
            overlay.showModal();
        } catch (_) {
            document.querySelectorAll('dialog[open]').forEach((dialog) => {
                if (dialog !== overlay) {
                    try { dialog.close(); } catch (error) { console.warn('Falha ao fechar modal anterior:', error.message); }
                }
            });
            overlay.showModal();
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const input = overlay.querySelector('#reset-confirm-input');
        const error = overlay.querySelector('#reset-confirm-error');
        const form = overlay.querySelector('form');
        const cancel = overlay.querySelector('[data-action="cancel"]');

        function close(result) {
            try { overlay.close(); } catch (_) { /* ja fechado */ }
            overlay.remove();
            resolve(result);
        }

        cancel.addEventListener('click', () => close(false));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close(false);
        });
        overlay.addEventListener('cancel', (event) => {
            event.preventDefault();
            close(false);
        });
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if ((input.value || '').trim() !== 'RESETAR') {
                error.classList.remove('hidden');
                input.focus();
                return;
            }
            close(true);
        });

        setTimeout(() => input.focus(), 0);
    });
}

// Reset único: apaga dados operacionais locais e preserva credenciais do gestor.
async function resetTotal() {
    const confirmado = await pedirConfirmacaoResetTotal();
    if (!confirmado) return;

    // Mostra modal de progresso (não bloqueante)
    const overlay = document.createElement('div');
    overlay.id = 'reset-progress-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:#0a1a2b;color:#e2e8f0;padding:30px;border-radius:16px;max-width:400px;width:90%;text-align:center;font-family:system-ui;border:1px solid #1f3a54">
        <h3 style="font-weight:800;margin-bottom:8px;color:#f87171">Resetando dados locais...</h3>
        <p id="reset-step" style="color:#94a3b8;font-size:0.9rem">Iniciando...</p>
      </div>
    `;
    document.body.appendChild(overlay);
    const setStep = (msg) => { const el = document.getElementById('reset-step'); if (el) el.textContent = msg; };

    try {
        setStep('Apagando dados locais (SQLite)...');
        const sessionOk = localStorage.getItem(typeof SESSION_KEY !== 'undefined' ? SESSION_KEY : '__placeholder__');
        const gestorNome = localStorage.getItem('gestorNome');
        const result = await window.db.resetData();
        if (!result || result.success !== true) {
            throw new Error(result?.error || 'Falha ao resetar banco local');
        }
        if (sessionOk && typeof SESSION_KEY !== 'undefined') localStorage.setItem(SESSION_KEY, sessionOk);
        if (gestorNome) localStorage.setItem('gestorNome', gestorNome);
        try {
            if (window.db && window.db.setLastSync) await window.db.setLastSync('');
        } catch (error) {
            console.warn('[engine] Falha ao limpar cursor de sync:', error.message);
        }

        overlay.remove();

        let resumo = 'RESET LOCAL CONCLUIDO\n\n';
        resumo += 'Apagado: clientes, contratos, transações, caixa, recibos, arquivos e logs.\n\nO sistema será recarregado.';
        alert(resumo);
        location.reload();

    } catch (err) {
        overlay.remove();
        alert('Erro no reset: ' + (err.message || 'desconhecido') + '\n\nVerifique o console (F12) e tente novamente.');
        console.error('[ResetLocal]', err);
    }
}

// SEÇÃO 6 — UTILITÁRIOS DE NEGÓCIO
// exportData() ? exporta backup JSON completo
// salvarNoPendrive() ? usa File System Access API para salvar em USB
// restaurarDoPendrive() ? restaura de arquivo JSON
// exportToExcel() ? gera Excel de clientes (.xlsx)
function exportData() {
    try {
        const jsonContent = JSON.stringify(state, null, 2);
        // No Electron, usa o diálogo nativo de backup JSON.
        if (window.electronAPI && window.electronAPI.saveBackup) {
            window.electronAPI.saveBackup(jsonContent).then(result => {
                if (result.success) {
                    if (result.filePath) {
                        showToast("Backup salvo em Documentos: " + result.filePath);
                    } else {
                        showToast("Backup robusto gerado com sucesso!");
                    }
                } else if (result.error) {
                    showToast("Erro ao gerar backup: " + result.error);
                }
            });
            return;
        }
        const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
        saveAs(blob, "backup_financeiro_full_" + new Date().toISOString().slice(0, 10) + ".json");
        showToast("Backup robusto gerado com sucesso!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao gerar backup: " + e.message);
    }
}

async function salvarNoPendrive() {
    // No desktop, salva uma copia fisica consistente do SQLite.
    if (window.electronAPI && window.electronAPI.savePhysicalBackup) {
        try {
            const result = await window.electronAPI.savePhysicalBackup(state);
            if (result.canceled) return;
            if (result.success) {
                showToast("Cópia SQLite salva em: " + (result.filePath || result.path));
            } else {
                showToast("Erro ao salvar: " + result.error);
            }
        } catch (err) {
            console.error(err);
            showToast("Erro ao salvar: " + err.message);
        }
        return;
    }
    // Fallback para navegador
    exportData();
}

async function restaurarDoPendrive() {
    // Usa modal de confirmação não-bloqueante
    const confirmar = await new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
                <h3 class="text-lg font-bold text-red-600 mb-3 flex items-center gap-2">
                    <i data-lucide="triangle-alert" class="w-5 h-5"></i> Atenção
                </h3>
                <p class="text-sm text-slate-700 dark:text-slate-300 mb-5">Isso vai substituir TODOS os dados atuais pelos dados do arquivo de backup.<br><br>Deseja continuar?</p>
                <div class="flex gap-3 justify-end">
                    <button id="_restore-cancel" class="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium">Cancelar</button>
                    <button id="_restore-confirm" class="px-4 py-2 rounded-lg bg-red-600 text-white font-medium">Restaurar</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        refreshIcons();
        overlay.querySelector('#_restore-cancel').onclick = () => { document.body.removeChild(overlay); resolve(false); };
        overlay.querySelector('#_restore-confirm').onclick = () => { document.body.removeChild(overlay); resolve(true); };
    });
    if (!confirmar) return;

    // Usa o diálogo nativo do Electron para abrir backup JSON.
    if (window.electronAPI && window.electronAPI.openBackup) {
        try {
            const result = await window.electronAPI.openBackup();
            if (result.canceled) return;
            if (!result.success) {
                showToast("Erro ao ler arquivo: " + (result.error || 'Arquivo não selecionado'));
                return;
            }
            if (result.checksumValid === false) {
                throw new Error("Integridade do backup inválida (checksum não confere).");
            }
            const backupContent = result.content || result.data;
            if (!backupContent) throw new Error("Conteúdo do backup não encontrado.");
            const dados = JSON.parse(backupContent);
            if (!dados.clientes || !dados.emprestimos) throw new Error("Arquivo inválido.");
            state = dados;
            await saveData();
            showToast("Dados restaurados com sucesso! Recarregando...");
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            showToast("Erro ao ler arquivo: " + err.message);
        }
        return;
    }
    showToast("Use o botão de backup para salvar/restaurar.");
}

function exportToExcel() {
    if (!state.clientes.length) {
        alert("Não há dados para exportar.");
        return;
    }
    const clientesData = state.clientes.map(c => {
        const emUso = getClientUsedCredit(c.id, 'avulso');
        return {
            "ID": c.id,
            "Nome Completo": c.nome,
            "Matrícula": c.matricula || '-',
            "CPF/CNPJ": c.cpf || '-',
            "Telefone": c.telefone,
            "Limite (R$)": c.limite,
            "Em Uso (R$)": emUso,
            "Disponível (R$)": c.limite - emUso
        };
    });
    const wb = XLSX.utils.book_new();
    const wsClientes = XLSX.utils.json_to_sheet(clientesData);
    XLSX.utils.book_append_sheet(wb, wsClientes, "Lista de Clientes");
    const fileName = `Relatorio_CredGestor_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast("Relatório Excel gerado!");
}

// -- Score Badges para o radar do Analista AI --
function calcularScore(clienteId) {
    return Math.round(analyzeRisk(clienteId).score);
}

function getScoreBadge(score, id) {
    let colorClass = "";
    let label = "";
    if (score >= 800) { colorClass = "bg-emerald-100 text-emerald-800 border border-emerald-200"; label = "Excelente"; }
    else if (score >= 600) { colorClass = "bg-blue-100 text-blue-800 border border-blue-200"; label = "Bom"; }
    else if (score >= 400) { colorClass = "bg-yellow-100 text-yellow-800 border border-yellow-200"; label = "Regular"; }
    else { colorClass = "bg-red-100 text-red-800 border border-red-200"; label = "Risco Alto"; }

    return `<div class="flex flex-col items-center cursor-pointer group" onclick="openAnalystModal('${id}')">
                <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${score}</span>
                <span class="${colorClass} badge flex items-center gap-1 transition-transform group-hover:scale-105"><i data-lucide="brain-circuit" class="w-3 h-3"></i> ${label}</span>
            </div>`;
}

// SEÇÃO 7 — ROTEAMENTO SPA (Single Page Application)
// router(view) troca o conteúdo de #app-content.
// Views: dashboard, clientes, extratos, em_aberto, inadimplentes, finalizados.
// updateUI() re-renderiza a view atual sem trocar de tela.
function router(view) {
    const content = document.getElementById('app-content');
    const title = document.getElementById('page-title');
    if (!content || !title) return;

    // Page transition animation
    content.classList.remove('page-enter');
    void content.offsetWidth; // Force reflow to restart animation
    content.classList.add('page-enter');

    // Reset all nav items to inactive state
    document.querySelectorAll('.sidebar-nav-item').forEach(el => {
        el.classList.remove('nav-active');
    });

    // Set active state on target nav button
    const navBtn = document.getElementById(`nav-${view}`);
    if (navBtn) {
        navBtn.classList.add('nav-active');
    }

    let isDashboard = false;
    try {
        if (view === 'operacoes') { title.innerText = 'Central de Operações'; renderOperacoes(content); }
        else if (view === 'dashboard') { title.innerText = 'Dashboard Financeiro'; renderDashboard(content); isDashboard = true; }
        else if (view === 'clientes') { title.innerText = 'Gestão de Clientes'; renderClientes(content); }
        else if (view === 'extratos') { title.innerText = 'Extratos & Histórico'; renderExtratos(content); }
        else if (view === 'em_aberto') { title.innerText = 'Empréstimos em Aberto'; renderFilteredLoans(content, 'em_aberto'); }
        else if (view === 'inadimplentes') { title.innerText = 'Carteira Inadimplente'; renderFilteredLoans(content, 'inadimplentes'); }
        else if (view === 'finalizados') { title.innerText = 'Contratos Finalizados'; renderFilteredLoans(content, 'finalizados'); }
        else if (view === 'esteira') { title.innerText = 'Esteira de Contratos'; renderEsteiraContratos(content); }
        else if (view === 'aprovados') { title.innerText = 'Contratos Aprovados'; renderFilteredLoans(content, 'aprovados'); }
        else if (view === 'em_analise') { title.innerText = 'Contratos em Análise'; renderFilteredLoans(content, 'em_analise'); }
        else if (view === 'reprovados') { title.innerText = 'Contratos Reprovados'; renderFilteredLoans(content, 'reprovados'); }
        else if (view === 'arquivo_aprovados') { title.innerText = 'Arquivo de Aprovados'; renderArquivoAprovados(content); }
        else if (view === 'recibos') { title.innerText = 'Central de Recibos'; renderCentralRecibos(content); }
        else if (view === 'admin_usuarios') { title.innerText = 'Gerenciar Usuários'; renderAdminUsuarios(content); }
        else if (view === 'admin_rede') {
            title.innerText = 'Recurso removido';
            content.innerHTML = `
                <div class="h-full flex items-center justify-center p-6">
                    <div class="max-w-lg w-full rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <i data-lucide="hard-drive" class="w-10 h-10 mx-auto text-slate-500 mb-3"></i>
                        <p class="text-sm font-bold text-slate-800">Modo offline ativo</p>
                        <p class="mt-2 text-xs text-slate-500">Acesso remoto e compartilhamento em rede foram removidos.</p>
                    </div>
                </div>`;
            refreshIcons();
        }
        else if (view === 'projecao') { title.innerText = 'Projeção Financeira'; renderProjecao(content); }
        else if (view === 'metas') { title.innerText = 'Metas & KPIs'; renderMetas(content); }
        else if (view === 'auditoria') { title.innerText = 'Auditoria'; renderAuditoria(content); }
        else if (['whatsapp_conexao', 'whatsapp_config', 'whatsapp_disparos', 'portal_web'].includes(view)) {
            title.innerText = 'Recurso removido';
            content.innerHTML = `
                <div class="h-full flex items-center justify-center p-6">
                    <div class="max-w-lg w-full rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <i data-lucide="hard-drive" class="w-10 h-10 mx-auto text-slate-500 mb-3"></i>
                        <p class="text-sm font-bold text-slate-800">Modo offline ativo</p>
                        <p class="mt-2 text-xs text-slate-500">Integrações externas foram removidas desta versão.</p>
                    </div>
                </div>`;
            refreshIcons();
        }
        else throw new Error(`Rota não reconhecida: ${view}`);
    } catch (err) {
        console.error(`[Router] Falha ao renderizar "${view}"`, err);
        title.innerText = 'Falha ao abrir tela';
        content.innerHTML = `
            <div class="h-full flex items-center justify-center p-6">
                <div class="max-w-lg w-full rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
                    <p class="text-sm font-bold text-red-700">Não foi possível abrir esta tela.</p>
                    <p class="mt-2 text-xs text-red-600">Tente novamente em alguns segundos. Se persistir, reinicie o aplicativo.</p>
                </div>
            </div>
        `;
        if (typeof showToast === 'function') {
            showToast(`Erro ao abrir "${view}".`, 'error');
        }
    }

    updateHeaderSaldo();
    refreshIcons();

    // Animate dashboard numbers after render
    if (isDashboard) {
        requestAnimationFrame(() => {
            const dashCaixa = document.getElementById('dash-caixa');
            if (dashCaixa && typeof animateNumber === 'function') {
                animateNumber(dashCaixa, state.caixa.saldo, 900);
            }
        });
    }

    // Close mobile sidebar after navigation
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
            setTimeout(() => toggleMobileSidebar(), 100);
        }
    }
}

function updateUI() {
    // Invalidar cache de risco ao atualizar dados
    invalidateRiskCache();
    // Re-renderiza a página atual para refletir mudanças
    const activeNav = document.querySelector('.sidebar-nav-item.nav-active');
    updateHeaderSaldo();
    if (activeNav) router(activeNav.id.replace('nav-', ''));
}

// SEÇÃO 8 — HELPERS FINANCEIROS + SANITIZAÇÃO

/**
 * [SEGURANÇA] Sanitiza strings para prevenir XSS ao inserir em innerHTML.
 * Escapa caracteres HTML perigosos: & < > " '
 * DEVE ser chamada em TODO dado do usuário renderizado via innerHTML.
 */
function S(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
// Disponível globalmente (views.js / features.js / intelligence.js usam o mesmo S).
if (typeof window !== 'undefined') {
    window.S = S;
    if (!window.escapeHtml) window.escapeHtml = S;
}

// formatMoney()     ? formata em R$ brasileiro
// addDays/addMonths ? aritmética de datas
// parseLocalDate()  ? parse seguro sem bug de timezone UTC
// getStatus()       ? classifica parcela (em dia / atrasado / inadimplente)
// getClientUsedCredit() ? soma crédito em uso do cliente
// calcularMulta()   ? calcula multa por dias de atraso
function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function addMonths(date, months) {
    const result = new Date(date);
    const targetMonth = result.getMonth() + months;
    result.setMonth(targetMonth);
    // Corrigir estouro de mês (ex: 31 jan + 1 mês = 3 mar em vez de 28 fev)
    if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
        result.setDate(0); // Volta para o último dia do mês anterior
    }
    return result;
}

// Helper para parsear data no formato YYYY-MM-DD como data LOCAL (evita bug UTC)
function getToday() { return new Date().toISOString().split('T')[0]; }

function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const [ano, mes, dia] = dateStr.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
}

function getStatus(vencimento, dataPagamento, carenciaDias) {
    if (dataPagamento) return { label: 'Pago', color: 'bg-green-100 text-green-700', code: 'pago' };
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = parseLocalDate(vencimento);
    venc.setHours(0, 0, 0, 0);
    const diffTime = hoje - venc;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const grace = Math.max(0, Math.round(Number.isFinite(Number(carenciaDias)) ? Number(carenciaDias) : getConfigNumber('defaultCarenciaDias', 5, 0, 365)));
    if (diffDays > grace) return { label: 'Inadimplente', color: 'bg-red-100 text-red-700', code: 'inadimplente', diasAtraso: diffDays };
    if (diffDays > 0) return { label: 'Atrasado', color: 'bg-orange-100 text-orange-700', code: 'atrasado', diasAtraso: diffDays };
    return { label: 'Em dia', color: 'bg-blue-100 text-blue-700', code: 'em_dia' };
}

function normalizeContractType(tipo) {
    const clean = String(tipo || '').trim().toLowerCase();
    if (clean === 'parcelado') return 'parcelado';
    if (clean === 'cartao' || clean === 'cartão') return 'cartao';
    // Tipos extras (configuráveis): mantém a key original (lowercase, sem acentos)
    if (clean && clean !== 'avulso') {
        const tipos = getCreditTipos();
        const match = tipos.find(t => t.key === clean);
        if (match && match.isExtra) return clean;
    }
    return 'avulso';
}

// ─── TIPOS DE CRÉDITO CONFIGURÁVEIS ─────────────────────────────────────────
// Os 3 tipos padrão (avulso/parcelado/cartao) NÃO podem ser removidos pois
// mapeiam para colunas físicas no banco (limite, limite_parcelado, limite_cartao).
// Rótulos são editáveis. Tipos extras são adicionados em state.config.creditTiposExtras
// e usam o limite BASE do cliente (mesmo campo "limite").
const CREDIT_TIPOS_DEFAULT_LABELS = { avulso: 'Avulso', parcelado: 'Parcelado', cartao: 'Cartão' };
const CREDIT_TIPOS_BAR_CLASS = { avulso: 'bg-brand-500', parcelado: 'bg-amber-500', cartao: 'bg-cyan-500' };
const CREDIT_TIPOS_EXTRA_BARS = ['bg-purple-500', 'bg-rose-500', 'bg-teal-500', 'bg-indigo-500', 'bg-lime-500'];

function _parseJsonConfig(raw, fallback) {
    if (raw === undefined || raw === null) return fallback;
    if (typeof raw === 'object') return raw;
    try {
        const parsed = JSON.parse(String(raw || ''));
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (_) { return fallback; }
}

function getCreditTiposLabels() {
    const cfg = state && state.config ? state.config : {};
    const saved = _parseJsonConfig(cfg.creditTiposLabels, null);
    return {
        avulso: (saved && saved.avulso) || CREDIT_TIPOS_DEFAULT_LABELS.avulso,
        parcelado: (saved && saved.parcelado) || CREDIT_TIPOS_DEFAULT_LABELS.parcelado,
        cartao: (saved && saved.cartao) || CREDIT_TIPOS_DEFAULT_LABELS.cartao,
    };
}

function getCreditTiposExtras() {
    const cfg = state && state.config ? state.config : {};
    const parsed = _parseJsonConfig(cfg.creditTiposExtras, []);
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map(t => (t && typeof t === 'object' ? { key: String(t.key || '').trim().toLowerCase(), label: String(t.label || '').trim() } : null))
        .filter(t => t && t.key && t.label && !['avulso', 'parcelado', 'cartao'].includes(t.key));
}

function getCreditTipos() {
    const labels = getCreditTiposLabels();
    const extras = getCreditTiposExtras();
    const baseTipos = [
        { key: 'avulso', label: labels.avulso, bar: CREDIT_TIPOS_BAR_CLASS.avulso, isExtra: false },
        { key: 'parcelado', label: labels.parcelado, bar: CREDIT_TIPOS_BAR_CLASS.parcelado, isExtra: false },
        { key: 'cartao', label: labels.cartao, bar: CREDIT_TIPOS_BAR_CLASS.cartao, isExtra: false },
    ];
    const extrasMapped = extras.map((t, i) => ({
        key: t.key,
        label: t.label,
        bar: CREDIT_TIPOS_EXTRA_BARS[i % CREDIT_TIPOS_EXTRA_BARS.length],
        isExtra: true,
    }));
    return baseTipos.concat(extrasMapped);
}

function creditTipoKeyFromLabel(label) {
    const s = String(label || '').toLowerCase();
    const withoutAccents = typeof s.normalize === 'function' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
    return withoutAccents
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32);
}

function getClientLimitByType(clienteId, tipoContrato = 'avulso') {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return 0;
    return getClienteLimitPorTipo(cliente, tipoContrato);
}

// Lê o limite de um cliente para um tipo específico. Legacy vem das colunas
// dedicadas; tipos extras vêm do JSON limites_tipos (e caem para o limite
// base se o valor não foi definido).
function getClienteLimitPorTipo(cliente, tipoContrato) {
    if (!cliente) return 0;
    const limiteBase = Math.max(0, Number(cliente.limite) || 0);
    const tipo = normalizeContractType(tipoContrato);
    if (tipo === 'parcelado') {
        const v = Number(cliente.limiteParcelado ?? cliente.limite_parcelado);
        return Math.max(0, Number.isFinite(v) ? v : limiteBase);
    }
    if (tipo === 'cartao') {
        const v = Number(cliente.limiteCartao ?? cliente.limite_cartao);
        return Math.max(0, Number.isFinite(v) ? v : limiteBase);
    }
    if (tipo === 'avulso') return limiteBase;
    // Tipos extras: lê do JSON limites_tipos do cliente; fallback = limite base.
    const extras = (cliente.limitesTipos && typeof cliente.limitesTipos === 'object') ? cliente.limitesTipos : {};
    const v = Number(extras[tipo]);
    return Math.max(0, Number.isFinite(v) ? v : limiteBase);
}

function getClientUsedCredit(clienteId, tipoContrato = null) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    const tipoLimite = cliente ? (cliente.tipoLimite || 'total') : 'total';
    const tipoFiltro = tipoContrato ? normalizeContractType(tipoContrato) : null;
    return state.emprestimos
        .filter(e => {
            if (e.clienteId !== clienteId) return false;
            if (e.statusGeral !== 'ativo') return false;
            if (!tipoFiltro) return true;
            return normalizeContractType(e.tipo) === tipoFiltro;
        })
        .reduce((total, emp) => {
            const pendente = (emp.parcelas || []).filter(p => p.status === 'pendente')
                .reduce((sum, p) => {
                    const valorBase = Number(p.valorBase) || 0;
                    if (tipoLimite === 'principal') {
                        const principalParcela = valorBase / (1 + ((Number(emp.taxaJuros) || 0) / 100));
                        return sum + principalParcela;
                    }
                    return sum + valorBase;
                }, 0);
            return total + pendente;
        }, 0);
}

function calcularMulta(valorParcela, diasAtraso, taxaDiaria, multaFixa, carenciaDias) {
    const dias = Math.max(0, Math.floor(Number(diasAtraso) || 0));
    const grace = Math.max(0, Math.round(Number.isFinite(Number(carenciaDias)) ? Number(carenciaDias) : getConfigNumber('defaultCarenciaDias', 5, 0, 365)));
    if (dias <= grace) return 0;

    const diasParaCobrar = dias - grace;
    const diaria = Math.max(0, Number.isFinite(Number(taxaDiaria)) ? Number(taxaDiaria) : getConfigNumber('defaultMultaDiaria', 1, 0, 1000));
    const fixa = Math.max(0, Number.isFinite(Number(multaFixa)) ? Number(multaFixa) : getConfigNumber('defaultMultaFixa', 0, 0, 999999999));
    const parcela = Math.max(0, Number(valorParcela) || 0);
    return fixa + (parcela * (diaria / 100) * diasParaCobrar);
}

// SEÇÃO 9 — GESTÃO DE CAIXA & CONFIGURAÇÕES
// updateHeaderSaldo() ? atualiza o saldo no header
// abrirModalAporte()  ? modal de depósito
// realizarAporte()    ? processa depósito no caixa
// abrirConfiguracoes() ? modal de config
// salvarConfiguracoes() ? salva nome/telefone da empresa

function updateHeaderSaldo() {
    const saldoEl = document.getElementById('header-saldo');
    if (saldoEl) saldoEl.innerText = formatMoney(state.caixa.saldo);
    // Atualizar contador de clientes no header
    const countEl = document.getElementById('header-clientes-count');
    if (countEl) countEl.textContent = (state.clientes || []).filter(c => c.status !== 'inativo').length;
    // Atualizar badges de contagem na sidebar
    updateSidebarBadges();
}

function updateSidebarBadges() {
    const clients = state.clientes || [];
    const loans = state.emprestimos || [];
    const hoje = new Date();
    let totalClientes = 0, abertos = 0, inadimplentes = 0, blacklistCount = 0;
    let aprovadosCount = 0, emAnaliseCount = 0, reprovadosCount = 0;

    // Uma única passada nos clientes
    for (let i = 0; i < clients.length; i++) {
        if (clients[i].status !== 'inativo') totalClientes++;
        if (clients[i].blacklist === true) blacklistCount++;
    }

    // Uma única passada nos empréstimos
    for (let i = 0; i < loans.length; i++) {
        const e = loans[i];
        if (e.statusGeral !== 'ativo' && e.status !== 'ativo') continue;
        const ap = e.aprovacao || 'aprovado';
        if (ap === 'aprovado') aprovadosCount++;
        else if (ap === 'em_analise') emAnaliseCount++;
        else if (ap === 'reprovado') reprovadosCount++;
        if (ap !== 'aprovado') continue;
        abertos++;
        const parcelas = e.parcelas || [];
        for (let j = 0; j < parcelas.length; j++) {
            if (parcelas[j].status === 'pendente' && parcelas[j].vencimento) {
                const venc = parseLocalDate(parcelas[j].vencimento);
                if (venc < hoje) { inadimplentes++; break; }
            }
        }
    }

    const setBadge = (id, count, show) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (show && count > 0) {
            el.textContent = count > 999 ? '999+' : count;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    };
    setBadge('nav-clientes-count', totalClientes, true);
    setBadge('nav-aberto-count', abertos, true);
    setBadge('nav-inad-count', inadimplentes, true);
    setBadge('nav-blacklist-count', blacklistCount, true);
    setBadge('nav-aprovados-count', aprovadosCount, true);
    setBadge('nav-analise-count', emAnaliseCount, true);
    setBadge('nav-reprovados-count', reprovadosCount, true);
    setBadge('nav-arquivo-count', (state.arquivoAprovados || []).length, true);
    setBadge('nav-recibos-count', 0, false);
    try {
        if (window.db && typeof window.db.listarRecibosPendentes === 'function') {
            window.db.listarRecibosPendentes().then((recibos) => {
                const total = Array.isArray(recibos) ? recibos.length : 0;
                setBadge('nav-recibos-count', total, true);
            }).catch(() => setBadge('nav-recibos-count', 0, false));
        }
    } catch (_) { /* contador de recibos e opcional */ }

    // Cobrança do dia — usa cache para não varrer tudo a cada navegação
    try {
        if (typeof getCobrancasDoDia === 'function') {
            const now = Date.now();
            if (!_cobrancasCache || (now - _cobrancasCacheTime) > _COBRANCAS_TTL) {
                _cobrancasCache = getCobrancasDoDia();
                _cobrancasCacheTime = now;
            }
            setBadge('nav-cobranca-count', _cobrancasCache.length, true);
        }
    } catch (e) { /* getCobrancasDoDia pode não existir ainda no bootstrap */ }
}

function abrirModalAporte() {
    closeModal('modal-emprestimo'); // Caso venha de lá
    openModal('modal-aporte');
    document.getElementById('valor-aporte').focus();
}

async function realizarAporte(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const valor = parseFloat(document.getElementById('valor-aporte').value);
    const desc = document.getElementById('desc-aporte').value;

    if (valor <= 0) return alert("Valor inválido");

    if (!state.caixa) state.caixa = { saldo: 0, historico: [] };
    if (!Array.isArray(state.caixa.historico)) state.caixa.historico = [];

    const saldoAnterior = Number(state.caixa.saldo || 0);
    const saldoPosterior = saldoAnterior + valor;
    const histEntry = {
        data: new Date().toISOString(),
        tipo: 'entrada',
        valor: valor,
        descricao: desc,
        saldoAnterior,
        saldoPosterior
    };
    state.caixa.saldo = saldoPosterior;
    state.caixa.historico.push(histEntry);

    try {
        if (submitBtn) submitBtn.disabled = true;
        const result = await persistCaixa(histEntry);
        if (!result || result.success !== true) {
            throw new Error(result?.error || 'Falha ao salvar aporte');
        }
        closeModal('modal-aporte');
        form.reset();
        showToast("Capital adicionado com sucesso!");
        updateUI();
    } catch (err) {
        state.caixa.saldo = saldoAnterior;
        const idx = state.caixa.historico.indexOf(histEntry);
        if (idx !== -1) state.caixa.historico.splice(idx, 1);
        showToast('Erro ao salvar capital: ' + (err?.message || 'falha desconhecida'), 'error');
        updateHeaderSaldo();
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function abrirConfiguracoes() {
    document.getElementById('conf-nome').value = state.config.empresaNome || '';
    document.getElementById('conf-tel').value = state.config.empresaTelefone || '';
    const inatividadeAtivo = String(state.config.inatividadeAlertaAtivo ?? '1');
    const inatividadeMeses = Number.parseInt(state.config.inatividadeAlertaMeses ?? '2', 10);
    const inatividadeMensagem = String(
        state.config.inatividadeMensagem ||
        'Ola {nome}, sentimos sua falta! Faz {meses} meses desde seu ultimo emprestimo. Se precisar, conte com a gente. - {empresa}'
    );
    const chk = document.getElementById('conf-inatividade-ativo');
    const inpMeses = document.getElementById('conf-inatividade-meses');
    const txtMensagem = document.getElementById('conf-inatividade-msg');
    if (chk) chk.checked = !(inatividadeAtivo === '0' || inatividadeAtivo.toLowerCase() === 'false');
    if (inpMeses) inpMeses.value = String(Number.isFinite(inatividadeMeses) && inatividadeMeses > 0 ? inatividadeMeses : 2);
    if (txtMensagem) txtMensagem.value = inatividadeMensagem;
    _preencherAbaTaxas();
    showConfigTab('operacoes');
    openModal('modal-config');
}

function salvarConfiguracoes(e) {
    e.preventDefault();
    state.config.empresaNome = document.getElementById('conf-nome').value;
    state.config.empresaTelefone = document.getElementById('conf-tel').value;
    const chk = document.getElementById('conf-inatividade-ativo');
    const inpMeses = document.getElementById('conf-inatividade-meses');
    const txtMensagem = document.getElementById('conf-inatividade-msg');
    const meses = Math.min(24, Math.max(1, Number.parseInt(inpMeses?.value || '2', 10) || 2));
    state.config.inatividadeAlertaAtivo = chk && chk.checked ? '1' : '0';
    state.config.inatividadeAlertaMeses = String(meses);
    state.config.inatividadeMensagem = (txtMensagem?.value || '').trim()
        || 'Ola {nome}, sentimos sua falta! Faz {meses} meses desde seu ultimo emprestimo. Se precisar, conte com a gente. - {empresa}';
    persistConfig();
    closeModal('modal-config');
    showToast("Identidade da empresa atualizada!");
}

// -- Tabs de Configuração (Operações / Empresa / Taxas / Tipos de Crédito / Segurança) --
function showConfigTab(tab) {
    const tabs = ['operacoes', 'empresa', 'taxas', 'tipos', 'seguranca'];
    tabs.forEach(t => {
        const tabBtn = document.getElementById(`tab-${t}`);
        const content = document.getElementById(`config-${t}`);
        if (!tabBtn || !content) return;
        if (tab === t) {
            tabBtn.className = 'config-tab px-4 py-2 text-sm font-bold rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300';
            content.classList.remove('hidden');
        } else {
            tabBtn.className = 'config-tab px-4 py-2 text-sm font-bold rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700';
            content.classList.add('hidden');
        }
    });
    if (tab === 'taxas') _preencherAbaTaxas();
    // Ao abrir a aba de Tipos, popula os campos com valores atuais.
    if (tab === 'tipos') _preencherAbaTiposCredito();
}

// ───────── ABA "TAXAS" ─────────
function _setConfigInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = String(value);
}

function _getConfigInputNumber(id, fallback, min = 0, max = 999999999) {
    const raw = document.getElementById(id)?.value;
    let n = Number(raw);
    if (!Number.isFinite(n)) n = fallback;
    n = Math.max(min, Math.min(max, n));
    return n;
}

function _preencherAbaTaxas() {
    const cfg = getLoanTemplateConfig();
    _setConfigInputValue('conf-taxa-avulso-20', cfg.taxaAvulso20);
    _setConfigInputValue('conf-taxa-avulso-30', cfg.taxaAvulso30);
    _setConfigInputValue('conf-taxa-parcelado', cfg.taxaParcelado);
    _setConfigInputValue('conf-taxa-cartao', cfg.taxaCartao);
    _setConfigInputValue('conf-taxa-outros', cfg.taxaOutros);
    _setConfigInputValue('conf-qtd-parcelas', cfg.qtdParcelas);
    _setConfigInputValue('conf-carencia-dias', cfg.carenciaDias);
    _setConfigInputValue('conf-multa-diaria', cfg.multaDiaria);
    _setConfigInputValue('conf-multa-fixa', cfg.multaFixa);
    const printFormat = document.getElementById('conf-print-format');
    if (printFormat) printFormat.value = getPrintConfig().format;
}

async function salvarTemplatesTaxas() {
    if (!state.config) state.config = {};
    state.config.defaultTaxaAvulso20 = String(_getConfigInputNumber('conf-taxa-avulso-20', 20, 0, 1000));
    state.config.defaultTaxaAvulso30 = String(_getConfigInputNumber('conf-taxa-avulso-30', 30, 0, 1000));
    state.config.defaultTaxaParcelado = String(_getConfigInputNumber('conf-taxa-parcelado', 0, 0, 1000));
    state.config.defaultTaxaCartao = String(_getConfigInputNumber('conf-taxa-cartao', 0, 0, 1000));
    state.config.defaultTaxaOutros = String(_getConfigInputNumber('conf-taxa-outros', 0, 0, 1000));
    state.config.defaultQtdParcelas = String(Math.round(_getConfigInputNumber('conf-qtd-parcelas', 2, 2, 360)));
    state.config.defaultCarenciaDias = String(Math.round(_getConfigInputNumber('conf-carencia-dias', 5, 0, 365)));
    state.config.defaultMultaDiaria = String(_getConfigInputNumber('conf-multa-diaria', 1, 0, 1000));
    state.config.defaultMultaFixa = String(_getConfigInputNumber('conf-multa-fixa', 0, 0, 999999999));
    const printFormat = document.getElementById('conf-print-format')?.value || 'a4';
    state.config.printReceiptFormat = ['a4', 'thermal80', 'thermal58'].includes(printFormat) ? printFormat : 'a4';

    const result = await persistConfig();
    if (result?.success) {
        showToast('Templates de taxas atualizados!');
    }
}

// ───────── ABA "TIPOS DE CRÉDITO" ─────────
function _preencherAbaTiposCredito() {
    const labels = (typeof getCreditTiposLabels === 'function') ? getCreditTiposLabels()
        : { avulso: 'Avulso', parcelado: 'Parcelado', cartao: 'Cartão' };
    const a = document.getElementById('conf-tipo-label-avulso');
    const p = document.getElementById('conf-tipo-label-parcelado');
    const c = document.getElementById('conf-tipo-label-cartao');
    if (a) a.value = labels.avulso || 'Avulso';
    if (p) p.value = labels.parcelado || 'Parcelado';
    if (c) c.value = labels.cartao || 'Cartão';
    _renderizarTiposExtras(getCreditTiposExtras());
}

function _renderizarTiposExtras(extras) {
    const box = document.getElementById('conf-tipos-extras-lista');
    if (!box) return;
    if (!Array.isArray(extras) || extras.length === 0) {
        box.innerHTML = '<p class="text-xs text-slate-400 italic py-2">Nenhum tipo extra adicionado.</p>';
        refreshIcons();
        return;
    }
    box.innerHTML = extras.map((t, idx) => `
        <div class="flex gap-2 items-center" data-tipo-idx="${idx}">
            <input type="text" value="${S(t.label || '')}" maxlength="40"
                placeholder="Ex.: FGTS, Consignado..."
                class="flex-1 input-premium rounded-xl p-2.5 text-sm font-medium conf-tipo-extra-input">
            <button type="button" onclick="removerTipoExtra(${idx})"
                class="px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl flex items-center gap-1">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        </div>
    `).join('');
    refreshIcons();
}

function _coletarTiposExtrasDoFormulario() {
    const inputs = document.querySelectorAll('.conf-tipo-extra-input');
    const usedKeys = new Set(['avulso', 'parcelado', 'cartao']);
    const resultado = [];
    inputs.forEach(inp => {
        const label = (inp.value || '').trim();
        if (!label) return;
        let key = creditTipoKeyFromLabel(label);
        if (!key) return;
        // Evita colisão com keys já usadas (default ou extras anteriores).
        let candidate = key; let n = 2;
        while (usedKeys.has(candidate)) { candidate = `${key}_${n++}`; }
        usedKeys.add(candidate);
        resultado.push({ key: candidate, label });
    });
    return resultado;
}

function adicionarTipoExtra() {
    const atuais = _coletarTiposExtrasDoFormulario();
    atuais.push({ key: '', label: '' });
    _renderizarTiposExtras(atuais);
}

function removerTipoExtra(idx) {
    const atuais = _coletarTiposExtrasDoFormulario();
    atuais.splice(idx, 1);
    _renderizarTiposExtras(atuais);
}

async function salvarTiposCredito() {
    const labels = {
        avulso: (document.getElementById('conf-tipo-label-avulso')?.value || '').trim() || 'Avulso',
        parcelado: (document.getElementById('conf-tipo-label-parcelado')?.value || '').trim() || 'Parcelado',
        cartao: (document.getElementById('conf-tipo-label-cartao')?.value || '').trim() || 'Cartão',
    };
    const extras = _coletarTiposExtrasDoFormulario();
    if (!state.config) state.config = {};
    state.config.creditTiposLabels = JSON.stringify(labels);
    state.config.creditTiposExtras = JSON.stringify(extras);
    try {
        await persistConfig();
        showToast('Tipos de crédito atualizados!');
        // Repopula o select do modal de empréstimo (caso esteja aberto).
        const selTipo = document.getElementById('emp-tipo');
        if (selTipo) {
            const tipos = getCreditTipos();
            selTipo.innerHTML = tipos.map(t => `<option value="${S(t.key)}">${S(t.label)}</option>`).join('');
        }
        updateUI();
    } catch (err) {
        console.error('[CONFIG] Falha ao salvar tipos de crédito:', err);
        showToast('Erro ao salvar tipos de crédito.', 'error');
    }
}

// SEÇÃO 10 — SEGURANÇA (Alteração, Reset e Recuperação de Senha)
// alterarSenha()  ? valida senha atual, aplica nova via SQLite
// resetarSenha()  ? usa Senha Master ou Senha Dev para liberar reset
async function alterarSenha(event) {
    event.preventDefault();
    const senhaAtual = document.getElementById('conf-senha-atual').value;
    const senhaNova = document.getElementById('conf-senha-nova').value;
    const senhaConfirmada = document.getElementById('conf-senha-confirmar').value;
    const feedback = document.getElementById('senha-feedback');

    if (senhaNova.length < 6) {
        feedback.textContent = 'A nova senha deve ter pelo menos 6 caracteres.';
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200';
        feedback.classList.remove('hidden');
        return;
    }

    if (senhaNova !== senhaConfirmada) {
        feedback.textContent = 'As senhas não coincidem.';
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200';
        feedback.classList.remove('hidden');
        return;
    }

    try {
        const result = await window.db.changePassword(senhaAtual, senhaNova);
        if (!result.success) {
            const msg = result.reason === 'wrong_current_password' ? 'Senha atual incorreta.' : 'Erro ao alterar senha.';
            feedback.textContent = msg;
            feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200';
            feedback.classList.remove('hidden');
            return;
        }

        feedback.textContent = '? Senha alterada com sucesso!';
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-600 border border-emerald-200';
        feedback.classList.remove('hidden');
        document.getElementById('conf-senha-atual').value = '';
        document.getElementById('conf-senha-nova').value = '';
        document.getElementById('conf-senha-confirmar').value = '';
        setTimeout(() => feedback.classList.add('hidden'), 4000);
    } catch (err) {
        feedback.textContent = 'Erro ao salvar nova senha. Tente novamente.';
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200';
        feedback.classList.remove('hidden');
    }
}

// -- Reset de Senha via Senha Master ou Senha Desenvolvedor --
async function resetarSenha() {
    // Mostrar modal de recuperação
    const modal = document.getElementById('modal-recovery');
    if (modal) {
        modal.showModal();
        const feedback = document.getElementById('recovery-feedback');
        if (feedback) { feedback.classList.add('hidden'); feedback.textContent = ''; }
        const input = document.getElementById('recovery-password');
        if (input) { input.value = ''; input.focus(); }
    }
}

async function handleRecoverySubmit(event) {
    event.preventDefault();
    const recoveryPass = document.getElementById('recovery-password').value.trim();
    const feedback = document.getElementById('recovery-feedback');

    if (!recoveryPass) {
        feedback.textContent = 'Digite a senha de recuperação.';
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200';
        feedback.classList.remove('hidden');
        return;
    }

    try {
        const result = await window.db.resetWithRecovery(recoveryPass);

        if (!result.success) {
            feedback.textContent = '? Senha de recuperação inválida. Tente a Senha Master ou a Senha Desenvolvedor.';
            feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200';
            feedback.classList.remove('hidden');
            return;
        }

        const level = result.level === 'developer' ? 'Desenvolvedor' : 'Master';
        feedback.textContent = `? Acesso liberado via Senha ${level}! Redirecionando para novo cadastro...`;
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-600 border border-emerald-200';
        feedback.classList.remove('hidden');

        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem('gestorNome');

        setTimeout(() => {
            document.getElementById('modal-recovery')?.close();
            location.reload();
        }, 2000);
    } catch (err) {
        feedback.textContent = 'Erro ao processar recuperação: ' + err.message;
        feedback.className = 'p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200';
        feedback.classList.remove('hidden');
    }
}


