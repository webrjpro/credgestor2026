// SEÇÃO 17 — CALCULADORA DE JUROS COMPOSTOS
// Calcula juros simples E compostos com tabela evolutiva.
// Exibe resultado na modal #modal-calculadora.
function abrirCalculadoraAvancada() {
    openModal('modal-calculadora');
    calcularJurosCompostos();
}

function calcularJurosCompostos() {
    const capital = parseFloat(document.getElementById('calc-adv-capital')?.value) || 0;
    const taxa = parseFloat(document.getElementById('calc-adv-taxa')?.value) || 0;
    const periodo = parseInt(document.getElementById('calc-adv-periodo')?.value) || 1;
    const tipo = document.getElementById('calc-adv-tipo')?.value || 'simples';

    let montante = 0;
    let juros = 0;
    let evolucao = [];

    if (tipo === 'simples') {
        juros = capital * (taxa / 100) * periodo;
        montante = capital + juros;
        for (let i = 1; i <= periodo; i++) {
            const jurosAcum = capital * (taxa / 100) * i;
            evolucao.push({ mes: i, juros: jurosAcum, montante: capital + jurosAcum });
        }
    } else {
        montante = capital * Math.pow(1 + (taxa / 100), periodo);
        juros = montante - capital;
        let acum = capital;
        for (let i = 1; i <= periodo; i++) {
            acum = acum * (1 + taxa / 100);
            evolucao.push({ mes: i, juros: acum - capital, montante: acum });
        }
    }

    const parcela = montante / periodo;

    document.getElementById('calc-adv-juros').textContent = formatMoney(juros);
    document.getElementById('calc-adv-montante').textContent = formatMoney(montante);
    document.getElementById('calc-adv-parcela').textContent = formatMoney(parcela);

    // Tabela de evolução
    if (periodo <= 12 && capital > 0) {
        let html = `<table class="w-full text-xs">
            <thead class="bg-slate-50 dark:bg-slate-700 sticky top-0">
                <tr><th class="p-2 text-left">Mês</th><th class="p-2 text-right">Juros Acum.</th><th class="p-2 text-right">Montante</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-600">`;
        evolucao.forEach(e => {
            html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700">
                <td class="p-2 font-bold">${e.mes}º</td>
                <td class="p-2 text-right text-purple-600">${formatMoney(e.juros)}</td>
                <td class="p-2 text-right font-bold">${formatMoney(e.montante)}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        document.getElementById('calc-adv-tabela').innerHTML = html;
    } else {
        document.getElementById('calc-adv-tabela').innerHTML = '';
    }
}

// SEÇÃO 17B — BLACKLIST AUTOMÁTICA
function getBlacklistClients() {
    return state.clientes.filter(c => c.blacklist === true);
}

function abrirBlacklist() {
    const content = document.getElementById('blacklist-content');
    const bloqueados = getBlacklistClients();

    if (bloqueados.length === 0) {
        content.innerHTML = `<div class="flex flex-col items-center justify-center p-8 text-center">
            <div class="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <i data-lucide="shield-check" class="w-8 h-8 text-green-500"></i>
            </div>
            <p class="text-slate-500 font-medium">Nenhum cliente na Blacklist.</p>
            <p class="text-slate-400 text-sm mt-1">Todos os clientes estão com score saudável.</p>
        </div>`;
    } else {
        content.innerHTML = `
        <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <p class="text-sm font-bold text-red-600 dark:text-red-400">${bloqueados.length} cliente(s) na Lista de Bloqueados</p>
            <p class="text-xs text-red-500 mt-1">Clientes bloqueados (manual ou automaticamente) não podem receber novos empréstimos.</p>
        </div>
        <div class="space-y-2">
        ${bloqueados.map(c => {
            const score = c.scoreCredito || 0;
            const motivo = (c.motivoBloqueio === 'manual')
                ? '<span class="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">MANUAL</span>'
                : '<span class="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">AUTOMÁTICO</span>';
            return `<div class="flex items-center justify-between p-4 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-700 dark:text-red-200 font-bold text-sm">
                        ${S((c.nome || '?').charAt(0))}
                    </div>
                    <div>
                        <p class="font-bold text-slate-800 dark:text-slate-200">${S(c.nome)}${motivo}</p>
                        <p class="text-xs text-slate-400">Score: <span class="font-bold text-red-500">${score}</span> • Pgtos em dia: ${c.pagamentosEmDia || 0}/10</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="abrirCRM('${c.id}')" class="p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors" title="Registro de contato">
                        <i data-lucide="message-square-text" class="w-4 h-4"></i>
                    </button>
                    <button onclick="removerDaBlacklist('${c.id}')" class="px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-bold transition-colors" title="Remover da blacklist manualmente">
                        <i data-lucide="shield-check" class="w-4 h-4 inline"></i> Desbloquear
                    </button>
                </div>
            </div>`;
        }).join('')}
        </div>`;
    }
    openModal('modal-blacklist');
    refreshIcons();
}

async function removerDaBlacklist(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;
    if (!confirm(`Deseja realmente desbloquear ${cliente.nome}?\n\nO score atual (${cliente.scoreCredito}) será mantido. O cliente poderá receber novos empréstimos.`)) return;
    const result = await persistClienteBlacklist(clienteId, false, '');
    if (!result?.success) return;
    showToast(`${result.cliente?.nome || cliente.nome} removido da Lista de Bloqueados.`);
    abrirBlacklist();
}

// ─── OBSERVAÇÃO DO EMPRÉSTIMO (editável pelo gestor) ───
// Abre modal com textarea pré-preenchido com a obs atual. Ao salvar, persiste
// no empréstimo e atualiza o banner amarelo acima do status de aprovação.
function abrirObservacaoEmprestimo() {
    if (!currentLoanId) { showToast('Abra um contrato primeiro.', 'error'); return; }
    const emp = state.emprestimos.find(e => e.id === currentLoanId);
    if (!emp) { showToast('Contrato não encontrado.', 'error'); return; }
    const ta = document.getElementById('txt-obs-emprestimo');
    if (ta) ta.value = emp.obs || '';
    openModal('modal-obs-emprestimo');
    refreshIcons();
    setTimeout(() => { try { ta?.focus(); } catch (error) { console.warn('[features] Falha ao focar observacao:', error.message); } }, 100);
}

async function salvarObservacaoEmprestimo() {
    if (!currentLoanId) return;
    const emp = state.emprestimos.find(e => e.id === currentLoanId);
    if (!emp) { showToast('Contrato não encontrado.', 'error'); return; }
    const ta = document.getElementById('txt-obs-emprestimo');
    const novoTexto = ((ta && ta.value) || '').slice(0, 2000).trim();
    emp.obs = novoTexto;

    try {
        const res = await persistEmprestimo(emp);
        if (!res || res.success !== true) throw new Error(res?.error || 'Falha ao salvar observação');

        // Atualiza banner acima do status
        const obsDisplay = document.getElementById('det-obs-display');
        const obsTexto = document.getElementById('det-obs-texto');
        if (obsDisplay && obsTexto) {
            if (novoTexto) {
                obsTexto.textContent = novoTexto;
                obsDisplay.classList.remove('hidden');
            } else {
                obsDisplay.classList.add('hidden');
                obsTexto.textContent = '';
            }
        }
        closeModal('modal-obs-emprestimo');
        showToast(novoTexto ? 'Observação salva.' : 'Observação removida.');
    } catch (err) {
        console.error('[OBS_EMPRESTIMO] erro ao salvar:', err);
        showToast('Erro ao salvar observação: ' + (err?.message || 'desconhecido'), 'error');
    }
}

// ─── DETALHES DE LIMITES POR TIPO (modal expansível) ───
// Chamado pelo botão "Ver limites" em cada linha da tabela de clientes.
// Escala para 10k clientes: só renderiza quando o usuário clica.
function abrirDetalhesLimites(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) { showToast('Cliente não encontrado.', 'error'); return; }
    const nomeEl = document.getElementById('limites-cliente-nome');
    const contentEl = document.getElementById('limites-cliente-content');
    if (!nomeEl || !contentEl) return;

    nomeEl.textContent = `${cliente.nome} • Matrícula: ${cliente.matricula || '—'}`;

    const tipos = (typeof getCreditTipos === 'function') ? getCreditTipos() : [];
    if (tipos.length === 0) {
        contentEl.innerHTML = '<p class="text-sm text-slate-400 italic">Nenhum tipo de crédito configurado.</p>';
        openModal('modal-limites-cliente');
        refreshIcons();
        return;
    }

    // Calcula "em uso" por tipo considerando apenas empréstimos ativos.
    const tipoLimiteCli = cliente.tipoLimite || 'total';
    const emUsoByTipo = {};
    for (const t of tipos) emUsoByTipo[t.key] = 0;
    for (const emp of state.emprestimos || []) {
        if (emp.clienteId !== clienteId) continue;
        if (emp.statusGeral !== 'ativo' && emp.status !== 'ativo') continue;
        const tKey = normalizeContractType(emp.tipo);
        let pendente = 0;
        for (const p of (emp.parcelas || [])) {
            if (p.status !== 'pendente') continue;
            const valorBase = Number(p.valorBase) || 0;
            pendente += (tipoLimiteCli === 'principal')
                ? valorBase / (1 + ((Number(emp.taxaJuros) || 0) / 100))
                : valorBase;
        }
        if (emUsoByTipo[tKey] === undefined) emUsoByTipo[tKey] = 0;
        emUsoByTipo[tKey] += pendente;
    }

    let totalLim = 0, totalUso = 0;
    const linhas = tipos.map(t => {
        const lim = getClienteLimitPorTipo(cliente, t.key);
        const uso = Math.max(0, Number(emUsoByTipo[t.key]) || 0);
        const saldo = Math.max(0, lim - uso);
        const pct = lim > 0 ? Math.min(100, (uso / lim) * 100) : 0;
        totalLim += lim; totalUso += uso;
        const pctColor = pct >= 90 ? 'bg-red-500' : (pct >= 70 ? 'bg-amber-500' : (t.bar || 'bg-brand-500'));
        return `
            <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-800/50">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${S(t.label)}${t.isExtra ? ' <span class="ml-1 text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">EXTRA</span>' : ''}</span>
                    <span class="text-xs font-bold ${pct >= 90 ? 'text-red-600' : (pct >= 70 ? 'text-amber-600' : 'text-slate-500')}">${pct.toFixed(0)}%</span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-[11px] mb-2">
                    <div><span class="text-slate-400 block">Limite</span><span class="font-bold text-slate-700 dark:text-slate-200">${formatMoney(lim)}</span></div>
                    <div><span class="text-slate-400 block">Em uso</span><span class="font-bold text-amber-600">${formatMoney(uso)}</span></div>
                    <div><span class="text-slate-400 block">Disponível</span><span class="font-bold text-emerald-600">${formatMoney(saldo)}</span></div>
                </div>
                <div class="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 overflow-hidden">
                    <div class="${pctColor} h-1.5 rounded-full transition-all duration-500" style="width:${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');

    const saldoTotal = Math.max(0, totalLim - totalUso);
    const pctTotal = totalLim > 0 ? (totalUso / totalLim) * 100 : 0;

    contentEl.innerHTML = `
        <div class="mb-2 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
            <div class="flex justify-between text-[11px] font-bold mb-1">
                <span class="text-slate-500">Total agregado</span>
                <span class="text-slate-400">${pctTotal.toFixed(0)}% usado</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-[11px]">
                <div><span class="text-slate-400 block">Soma limites</span><span class="font-bold text-slate-700 dark:text-slate-200">${formatMoney(totalLim)}</span></div>
                <div><span class="text-slate-400 block">Soma uso</span><span class="font-bold text-amber-600">${formatMoney(totalUso)}</span></div>
                <div><span class="text-slate-400 block">Disponível</span><span class="font-bold text-emerald-600">${formatMoney(saldoTotal)}</span></div>
            </div>
        </div>
        ${linhas}
    `;
    openModal('modal-limites-cliente');
    refreshIcons();
}

// ─── BLOQUEIO MANUAL (complementa o blacklist AUTOMÁTICO por score) ───
// Quando o gestor clica no botão "Bloquear" na tabela de clientes, o cliente
// entra na mesma Lista de Bloqueados do blacklist automático. O motivo fica
// registrado para diferenciar (motivoBloqueio = 'manual').
async function toggleClienteBloqueioManual(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    if (cliente.blacklist) {
        // Já está bloqueado — oferece desbloqueio.
        if (!confirm(`Desbloquear ${cliente.nome}?\n\nEle voltará a receber novos empréstimos normalmente.`)) return;
        const result = await persistClienteBlacklist(clienteId, false, '');
        if (!result?.success) return;
        showToast(`${result.cliente?.nome || cliente.nome} removido da Lista de Bloqueados.`);
        updateUI();
        return;
    }

    if (!confirm(`Bloquear ${cliente.nome} manualmente?\n\nEle será enviado para a Lista de Bloqueados e não poderá receber novos empréstimos até ser desbloqueado.`)) return;
    const result = await persistClienteBlacklist(clienteId, true, 'manual');
    if (!result?.success) return;
    showToast(`${result.cliente?.nome || cliente.nome} adicionado à Lista de Bloqueados.`, 'error');
    updateUI();
}

// SEÇÃO 17C — CRM SIMPLES (REGISTRO DE CONTATOS)
function abrirCRM(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    document.getElementById('crm-cliente-id').value = clienteId;
    document.getElementById('crm-subtitle').textContent = `Histórico de interações com ${cliente.nome}`;
    document.getElementById('crm-nota').value = '';

    renderContatosCRM(cliente);
    openModal('modal-crm');
    refreshIcons();
}

function renderContatosCRM(cliente) {
    const container = document.getElementById('crm-historico');
    const contatos = cliente.contatos || [];

    if (contatos.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400">
            <i data-lucide="message-square-dashed" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            <p class="text-sm">Nenhum contato registrado ainda.</p>
        </div>`;
        return;
    }

    const tipoIcons = { ligacao: 'phone', whatsapp: 'message-circle', visita: 'map-pin', promessa: 'calendar-check', outro: 'message-square' };
    const tipoLabels = { ligacao: 'Ligação', whatsapp: 'Mensagem', visita: 'Visita', promessa: 'Promessa', outro: 'Outro' };

    container.innerHTML = contatos.slice().reverse().map((ct, idx) => `
        <div class="flex gap-3 p-3 rounded-xl ${idx === 0 ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-700/50'} transition-colors">
            <span class="text-lg flex-shrink-0 text-sky-500"><i data-lucide="${tipoIcons[ct.tipo] || 'message-square'}" class="w-4 h-4"></i></span>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-xs font-bold text-slate-600 dark:text-slate-300">${S(tipoLabels[ct.tipo] || ct.tipo || 'Outro')}</span>
                    <span class="text-[10px] text-slate-400">${S(formatDate(ct.data))} às ${S(ct.hora || '--:--')}</span>
                </div>
                <p class="text-sm text-slate-700 dark:text-slate-300">${S(ct.nota)}</p>
            </div>
            <button onclick="removerContato('${encodeURIComponent(String(cliente.id || ''))}', '${encodeURIComponent(String(ct.data || ''))}', '${encodeURIComponent(String(ct.hora || ''))}')" class="text-slate-300 hover:text-red-500 p-1 flex-shrink-0 transition-colors" title="Remover">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        </div>
    `).join('');
}

function salvarContatoCRM(e) {
    e.preventDefault();
    const clienteId = document.getElementById('crm-cliente-id').value;
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const agora = new Date();
    const contato = {
        tipo: document.getElementById('crm-tipo').value,
        nota: document.getElementById('crm-nota').value.trim(),
        data: agora.toISOString().split('T')[0],
        hora: agora.toTimeString().slice(0, 5),
        gestor: getGestorName()
    };

    if (!Array.isArray(cliente.contatos)) cliente.contatos = [];
    cliente.contatos.push(contato);
    persistCliente(cliente);

    document.getElementById('crm-nota').value = '';
    renderContatosCRM(cliente);
    refreshIcons();
    showToast('Contato registrado!');
}

function removerContato(clienteId, data, hora) {
    try {
        clienteId = decodeURIComponent(String(clienteId || ''));
        data = decodeURIComponent(String(data || ''));
        hora = decodeURIComponent(String(hora || ''));
    } catch (error) {
        console.warn('[features] Identificador de contato codificado invalido:', error.message);
        return;
    }
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente || !Array.isArray(cliente.contatos)) return;
    const idx = cliente.contatos.findIndex(ct => ct.data === data && ct.hora === hora);
    if (idx === -1) return;
    cliente.contatos.splice(idx, 1);
    persistCliente(cliente);
    renderContatosCRM(cliente);
    refreshIcons();
}

// SEÇÃO 17D — DASHBOARD DE COBRANÇA DO DIA
function getCobrancasDoDia() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const items = [];

    state.emprestimos.forEach(emp => {
        if (emp.statusGeral !== 'ativo') return;
        const cliente = getClienteById(emp.clienteId);
        if (!cliente) return;

        emp.parcelas.forEach(p => {
            if (p.status !== 'pendente') return;
            const venc = parseLocalDate(p.vencimento);
            const diffDays = Math.floor((venc - hoje) / (1000 * 60 * 60 * 24));

            // Incluir: atrasados + vencendo hoje + vencendo em até 3 dias
            if (diffDays <= 3) {
                const multa = diffDays < 0 ? calcularMulta(p.valorBase, Math.abs(diffDays), emp.multaDiaria, emp.multaFixa, emp.carenciaDias) : 0;
                items.push({
                    clienteId: cliente.id,
                    cliente: cliente.nome,
                    telefone: cliente.telefone || '',
                    valor: p.valorBase,
                    multa,
                    total: p.valorBase + multa,
                    vencimento: p.vencimento,
                    dias: diffDays,
                    empId: emp.id,
                    parcelaNum: p.numero,
                    blacklist: cliente.blacklist || false,
                    score: cliente.scoreCredito || 500,
                    ultimoContato: (cliente.contatos || []).length > 0 ? cliente.contatos[cliente.contatos.length - 1] : null
                });
            }
        });
    });

    // Ordenar por mais atrasado primeiro
    items.sort((a, b) => a.dias - b.dias);
    return items;
}

function abrirDashboardCobranca() {
    const content = document.getElementById('cobranca-dia-content');
    const items = getCobrancasDoDia();
    const totalValor = items.reduce((s, i) => s + i.total, 0);
    const totalClientes = [...new Set(items.map(i => i.clienteId))].length;

    const subtitle = document.getElementById('cobranca-dia-subtitle');
    subtitle.textContent = `${totalClientes} cliente(s) • ${items.length} parcela(s) • Total: ${formatMoney(totalValor)}`;

    if (items.length === 0) {
        content.innerHTML = `<div class="flex flex-col items-center justify-center p-8 text-center">
            <div class="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                <i data-lucide="party-popper" class="w-8 h-8 text-emerald-500"></i>
            </div>
            <p class="text-emerald-600 font-bold text-lg">Dia livre.</p>
            <p class="text-slate-400 text-sm mt-1">Nenhuma cobrança pendente para hoje.</p>
        </div>`;
    } else {
        // Resumo no topo
        const atrasados = items.filter(i => i.dias < 0);
        const hojeItems = items.filter(i => i.dias === 0);
        const proximos = items.filter(i => i.dias > 0);

        let html = `
        <div class="grid grid-cols-3 gap-3 mb-5">
            <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-center border border-red-200 dark:border-red-800">
                <p class="text-2xl font-black text-red-600">${atrasados.length}</p>
                <p class="text-[10px] font-bold text-red-500 uppercase">Atrasados</p>
            </div>
            <div class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center border border-amber-200 dark:border-amber-800">
                <p class="text-2xl font-black text-amber-600">${hojeItems.length}</p>
                <p class="text-[10px] font-bold text-amber-500 uppercase">Vencem Hoje</p>
            </div>
            <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center border border-blue-200 dark:border-blue-800">
                <p class="text-2xl font-black text-blue-600">${proximos.length}</p>
                <p class="text-[10px] font-bold text-blue-500 uppercase">Próx. 3 dias</p>
            </div>
        </div>
        <div class="space-y-2">`;

        items.forEach(item => {
            const statusTag = item.dias < 0
                ? `<span class="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">${Math.abs(item.dias)}d atrasado</span>`
                : item.dias === 0
                    ? `<span class="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">HOJE</span>`
                    : `<span class="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">em ${item.dias}d</span>`;

            const blacklistTag = item.blacklist ? `<span class="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">BLACKLIST</span>` : '';
            const ultimoContatoText = item.ultimoContato
                ? `<span class="text-[10px] text-slate-400">Ultimo contato: ${item.ultimoContato.data} - ${S(item.ultimoContato.nota).substring(0, 40)}${item.ultimoContato.nota.length > 40 ? '...' : ''}</span>`
                : `<span class="text-[10px] text-orange-400 font-medium">Sem contato registrado</span>`;

            html += `
            <div class="flex items-center justify-between p-4 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:shadow-md transition-all">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-full ${item.dias < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} dark:bg-slate-600 dark:text-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        ${item.cliente.charAt(0)}
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="font-bold text-slate-800 dark:text-slate-200 truncate">${S(item.cliente)}</p>
                            ${statusTag} ${blacklistTag}
                        </div>
                        <p class="text-xs text-slate-500">Parc #${item.parcelaNum} - Venc: ${formatDate(item.vencimento)} ${item.multa > 0 ? '- Multa: ' + formatMoney(item.multa) : ''}</p>
                        ${ultimoContatoText}
                    </div>
                </div>
                <div class="text-right flex-shrink-0 ml-3">
                    <p class="font-black ${item.dias < 0 ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'}">${formatMoney(item.total)}</p>
                </div>
                <div class="flex gap-1.5 ml-3 flex-shrink-0">
                    <button onclick="abrirCRM('${item.clienteId}')" class="p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors" title="Registrar contato">
                        <i data-lucide="message-square-text" class="w-4 h-4"></i>
                    </button>
                    <button onclick="openPaymentModal('${encodeURIComponent(String(item.empId || ''))}')" class="p-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg transition-colors" title="Ver contrato">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>`;
        });

        html += '</div>';
        content.innerHTML = html;
    }

    openModal('modal-cobranca-dia');
    refreshIcons();
}

// SEÇÃO 18 — AGENDA DE COBRANÇAS
// abrirAgendaCobrancas() ? lista atrasados e próximos vencimentos
// As rotinas de mensagem externa foram removidas no modo offline.
function abrirAgendaCobrancas() {
    const content = document.getElementById('agenda-content');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Próximos 30 dias
    const proximos = [];
    const atrasados = [];

    state.emprestimos.forEach(emp => {
        if (emp.statusGeral !== 'ativo') return;
        const cliente = getClienteById(emp.clienteId);

        emp.parcelas.forEach(p => {
            if (p.status !== 'pendente') return;
            const venc = parseLocalDate(p.vencimento);
            const diffDays = Math.floor((venc - hoje) / (1000 * 60 * 60 * 24));

            const item = {
                cliente: cliente?.nome || 'Cliente',
                telefone: cliente?.telefone || '',
                valor: p.valorBase,
                vencimento: p.vencimento,
                dias: diffDays,
                empId: emp.id,
                parcelaNum: p.numero
            };

            if (diffDays < 0) {
                atrasados.push(item);
            } else if (diffDays <= 30) {
                proximos.push(item);
            }
        });
    });

    // Ordenar
    atrasados.sort((a, b) => a.dias - b.dias);
    proximos.sort((a, b) => a.dias - b.dias);

    let html = '';

    if (atrasados.length > 0) {
        html += `<div class="mb-6">
            <h4 class="font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                <i data-lucide="alert-triangle" class="w-4 h-4"></i> Atrasados (${atrasados.length})
            </h4>
            <div class="space-y-2">`;
        atrasados.forEach(a => {
            const empAtraso = state.emprestimos.find(e => e.id === a.empId);
            const multa = calcularMulta(a.valor, Math.abs(a.dias), empAtraso?.multaDiaria, empAtraso?.multaFixa, empAtraso?.carenciaDias);
            html += `
                <div class="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center text-red-700 dark:text-red-200 font-bold">
                            ${a.cliente.charAt(0)}
                        </div>
                        <div>
                            <p class="font-bold text-slate-800 dark:text-slate-200">${a.cliente}</p>
                            <p class="text-xs text-red-600">Parcela #${a.parcelaNum} • ${Math.abs(a.dias)} dias de atraso</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-black text-red-600 dark:text-red-400">${formatMoney(a.valor + multa)}</p>
                        <p class="text-[10px] text-red-500">+${formatMoney(multa)} multa</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="openPaymentModal('${encodeURIComponent(String(a.empId || ''))}')" class="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors" title="Ver Contrato">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>`;
        });
        html += '</div></div>';
    }

    if (proximos.length > 0) {
        html += `<div>
            <h4 class="font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                <i data-lucide="clock" class="w-4 h-4"></i> Próximos Vencimentos (${proximos.length})
            </h4>
            <div class="space-y-2">`;
        proximos.forEach(p => {
            const statusText = p.dias === 0 ? 'Vence HOJE!' : `Vence em ${p.dias} dia(s)`;
            const statusClass = p.dias === 0 ? 'text-amber-700 bg-amber-100' : 'text-slate-600 bg-slate-100';
            html += `
                <div class="flex items-center justify-between p-4 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:shadow-md transition-shadow">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-200 font-bold">
                            ${p.cliente.charAt(0)}
                        </div>
                        <div>
                            <p class="font-bold text-slate-800 dark:text-slate-200">${p.cliente}</p>
                            <p class="text-xs text-slate-500">Parcela #${p.parcelaNum} • ${formatDate(p.vencimento)}</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold px-2 py-1 rounded-full ${statusClass}">${statusText}</span>
                    <p class="font-black text-slate-800 dark:text-slate-200">${formatMoney(p.valor)}</p>
                </div>`;
        });
        html += '</div></div>';
    }

    if (atrasados.length === 0 && proximos.length === 0) {
        html = `<div class="text-center py-12">
            <div class="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
                <i data-lucide="check-circle" class="w-8 h-8 text-emerald-600 dark:text-emerald-400"></i>
            </div>
            <h4 class="font-bold text-lg text-slate-800 dark:text-slate-200">Tudo em dia!</h4>
            <p class="text-sm text-slate-500">Nenhuma cobrança pendente nos próximos 30 dias.</p>
        </div>`;
    }

    content.innerHTML = html;
    openModal('modal-agenda');
}

// Notificações via WhatsApp removidas no modo offline local
