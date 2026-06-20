// SEÇÃO 13  VIEWS FILTRADAS (Em Aberto / Inadimplentes / Finalizados)
// renderFilteredLoans() renderiza tabela de empréstimos com filtro.
// Cada linha mostra: ID, cliente, tipo, valor, status, botão Gerenciar.
function renderFilteredLoans(container, filterType) {
    let filteredLoans = [];
    let headerText = '';
    let emptyText = '';

    if (filterType === 'em_aberto') {
        headerText = 'Contratos em Aberto';
        emptyText = 'Nenhum contrato em aberto.';
        filteredLoans = state.emprestimos.filter(e => e.statusGeral === 'ativo' && (e.aprovacao || 'aprovado') === 'aprovado');
    } else if (filterType === 'inadimplentes') {
        headerText = 'Contratos Inadimplentes (> 5 Dias)';
        emptyText = 'Nenhum inadimplente! Parabéns.';
        filteredLoans = state.emprestimos.filter(e => {
            return e.statusGeral === 'ativo' && (e.aprovacao || 'aprovado') === 'aprovado' && e.parcelas.some(p => p.status === 'pendente' && getStatus(p.vencimento, null, e.carenciaDias).code === 'inadimplente');
        });
    } else if (filterType === 'finalizados') {
        headerText = 'Histórico de Finalizados';
        emptyText = 'Nenhum contrato finalizado ainda.';
        filteredLoans = state.emprestimos.filter(e => e.statusGeral === 'finalizado');
    } else if (filterType === 'aprovados') {
        headerText = 'Contratos Aprovados';
        emptyText = 'Nenhum contrato aprovado ou já impresso.';
        // Inclui 'aprovado' (pendentes de impressão) E 'arquivado' (já impressos) — o
        // gestor precisa da visão completa para saber o que já foi enviado à empresa
        // e o que ainda falta. Badge distingue os dois estados.
        filteredLoans = state.emprestimos.filter(e => {
            const ap = e.aprovacao || 'aprovado';
            return (ap === 'aprovado' || ap === 'arquivado') && e.statusGeral === 'ativo';
        });
    } else if (filterType === 'em_analise') {
        headerText = 'Contratos em Análise';
        emptyText = 'Nenhum contrato em análise.';
        filteredLoans = state.emprestimos.filter(e => e.aprovacao === 'em_analise');
    } else if (filterType === 'reprovados') {
        headerText = 'Contratos Reprovados';
        emptyText = 'Nenhum contrato reprovado.';
        filteredLoans = state.emprestimos.filter(e => e.aprovacao === 'reprovado');
    }

    filteredLoans.sort((a, b) => b.id - a.id);

    const btnImprimir = filterType === 'aprovados' ? `
                    <button onclick="imprimirRelatorioAprovados()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all whitespace-nowrap text-sm font-bold">
                        <i data-lucide="printer" class="w-4 h-4"></i> Imprimir
                    </button>` : '';

    container.innerHTML = `
        <div class="space-y-6 fade-in">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">${headerText} <span class="text-sm font-normal text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full ml-2">${filteredLoans.length}</span></h3>
                <div class="flex gap-2 w-full md:w-auto">
                    <div class="relative w-full md:w-64">
                        <i data-lucide="search" class="absolute left-3 top-2.5 h-5 w-5 text-slate-400"></i>
                        <input type="text" onkeyup="filterTable('loans-table', 1, this.value)" placeholder="Buscar cliente..." class="pl-10 pr-4 py-2 w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none shadow-sm text-sm dark:text-slate-200">
                    </div>
                    ${btnImprimir}
                    <button onclick="openLoanModal()" class="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all whitespace-nowrap text-sm font-bold">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i> Novo
                    </button>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm" id="loans-table">
                        <thead class="bg-slate-50/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-600">
                            <tr>
                                <th class="px-6 py-4">ID</th>
                                <th class="px-6 py-4">Cliente / Matrícula</th>
                                <th class="px-6 py-4">Tipo</th>
                                <th class="px-6 py-4">Total</th>
                                <th class="px-6 py-4">Status</th>
                                <th class="px-6 py-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 dark:divide-slate-700">
                            ${filteredLoans.map(emp => {
        const cliente = getClienteById(emp.clienteId);
        const overrideIcon = emp.liberadoPor ? `<i data-lucide="shield-check" class="w-4 h-4 text-brand-500 inline ml-1" title="Liberado por ${emp.liberadoPor}"></i>` : '';

        let statusBadge = `<span class="badge bg-blue-50 text-blue-700 border border-blue-100">Regular</span>`;
        if (emp.statusGeral === 'finalizado') {
            statusBadge = `<span class="badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">Finalizado</span>`;
        } else {
            const temAtraso = emp.parcelas.some(p => p.status === 'pendente' && getStatus(p.vencimento, null, emp.carenciaDias).code === 'atrasado');
            const temInadimplencia = emp.parcelas.some(p => p.status === 'pendente' && getStatus(p.vencimento, null, emp.carenciaDias).code === 'inadimplente');
            if (temInadimplencia) statusBadge = `<span class="badge bg-red-50 text-red-700 border border-red-100">Inadimplente</span>`;
            else if (temAtraso) statusBadge = `<span class="badge bg-orange-50 text-orange-700 border border-orange-100">Atrasado</span>`;
        }
        // Badge auxiliar: mostra se contrato aprovado já foi IMPRESSO (arquivado) ou está PENDENTE
        if (filterType === 'aprovados') {
            const ap = emp.aprovacao || 'aprovado';
            if (ap === 'arquivado') {
                statusBadge += ' <span class="badge bg-slate-200 text-slate-700 border border-slate-300 text-[9px] ml-1">IMPRESSO</span>';
            } else {
                statusBadge += ' <span class="badge bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] ml-1">PENDENTE</span>';
            }
        }

        return `
                                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors group">
                                    <td class="px-6 py-4 text-slate-400 font-mono text-xs">#${emp.id.toString().slice(-4)}</td>
                                    <td class="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand-600 transition-colors">${cliente ? S(cliente.nome) : 'Cliente removido'} ${overrideIcon}</td>
                                    <td class="px-6 py-4 capitalize text-slate-600 dark:text-slate-400">${(() => {
                                        const t = (typeof getCreditTipos === 'function' ? getCreditTipos() : []).find(x => x.key === normalizeContractType(emp.tipo));
                                        return t ? S(t.label) : S(emp.tipo);
                                    })()}</td>
                                    <td class="px-6 py-4 text-brand-600 font-bold">${formatMoney(emp.valorTotal)}</td>
                                    <td class="px-6 py-4">${statusBadge}</td>
                                    <td class="px-6 py-4 text-right">
                                        <button onclick="openPaymentModal('${encodeURIComponent(String(emp.id || ''))}')" class="text-slate-400 hover:text-brand-600 font-bold text-xs border border-slate-200 dark:border-slate-600 hover:border-brand-200 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg transition-all shadow-sm">
                                            Gerenciar
                                        </button>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                     ${filteredLoans.length === 0 ? `<div class="p-12 text-center text-slate-400">${emptyText}</div>` : ''}
                </div>
            </div>
        </div>
    `;
}
