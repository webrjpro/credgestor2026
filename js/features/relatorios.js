// SEÇÃO 19 — CENTRAL DE RELATÓRIOS (Excel via SheetJS)
// 4 relatórios disponíveis:
//   1. gerarRelatorioClientes()      ? Excel de clientes
//   2. gerarRelatorioEmprestimos()   ? Excel de empréstimos
//   3. gerarRelatorioFinanceiro()    ? Excel de fluxo de caixa
//   4. gerarRelatorioInadimplencia() ? Excel de inadimplentes
function abrirRelatorios() {
    openModal('modal-relatorios');
}

function gerarRelatorioClientes() {
    if (!state.clientes.length) return alert("Nenhum cliente cadastrado.");

    const dados = state.clientes.map(c => {
        const emUso = getClientUsedCredit(c.id, 'avulso');
        return {
            "Nome": c.nome,
            "Matrícula": c.matricula || '-',
            "CPF/CNPJ": c.cpf || '-',
            "Telefone": c.telefone,
            "Email": c.email || '-',
            "Limite (R$)": c.limite,
            "Em Uso (R$)": emUso,
            "Disponível (R$)": c.limite - emUso,
            "Score": Math.round(analyzeRiskCached(c.id).score),
            "Status": c.status?.toUpperCase() || 'ATIVO',
            "Data Cadastro": c.dataCadastro || '-'
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `Relatorio_Clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Relatório de clientes exportado!");
    closeModal('modal-relatorios');
}

function gerarRelatorioEmprestimos() {
    if (!state.emprestimos.length) return alert("Nenhum empréstimo registrado.");

    const dados = state.emprestimos.map(e => {
        const cliente = getClienteById(e.clienteId);
        const pago = e.parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valorPago, 0);
        const pendente = e.parcelas.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valorBase, 0);
        return {
            "ID": e.id,
            "Cliente": cliente?.nome || 'Removido',
            "Tipo": e.tipo,
            "Valor Original (R$)": e.valorOriginal,
            "Juros (%)": e.taxaJuros,
            "Valor Total (R$)": e.valorTotal,
            "Já Pago (R$)": pago,
            "Pendente (R$)": pendente,
            "Parcelas": e.parcelas.length,
            "Status": e.statusGeral.toUpperCase(),
            "Data Início": e.dataInicio,
            "Gestor Responsável": e.gestorResponsavel || '-',
            "Liberado Por": e.liberadoPor || '-'
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Empréstimos");
    XLSX.writeFile(wb, `Relatorio_Emprestimos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Relatório de empréstimos exportado!");
    closeModal('modal-relatorios');
}

function gerarRelatorioFinanceiro() {
    let totalEmprestado = 0, totalRecebido = 0, lucroJuros = 0, lucroMultas = 0;

    state.emprestimos.forEach(e => {
        totalEmprestado += e.valorOriginal;
        lucroJuros += (e.valorTotal - e.valorOriginal);
        e.parcelas.forEach(p => {
            if (p.status === 'pago') {
                totalRecebido += p.valorPago;
                lucroMultas += p.multaPaga || 0;
            }
        });
    });

    const dados = [{
        "Período": "Total Acumulado",
        "Capital Emprestado (R$)": totalEmprestado,
        "Total Recebido (R$)": totalRecebido,
        "Lucro em Juros (R$)": lucroJuros,
        "Lucro em Multas (R$)": lucroMultas,
        "Lucro Total (R$)": lucroJuros + lucroMultas,
        "Caixa Atual (R$)": state.caixa.saldo,
        "Qtd. Transações": state.transacoes.length
    }];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
    XLSX.writeFile(wb, `Relatorio_Financeiro_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Relatório financeiro exportado!");
    closeModal('modal-relatorios');
}

function gerarRelatorioInadimplencia() {
    const inadimplentes = [];

    state.emprestimos.forEach(emp => {
        if (emp.statusGeral !== 'ativo') return;
        const cliente = state.clientes.find(c => c.id === emp.clienteId);

        emp.parcelas.forEach(p => {
            if (p.status !== 'pendente') return;
            const status = getStatus(p.vencimento, null, emp.carenciaDias);
            if (status.code === 'inadimplente' || status.code === 'atrasado') {
                const multa = calcularMulta(p.valorBase, status.diasAtraso || 0, emp.multaDiaria, emp.multaFixa, emp.carenciaDias);
                inadimplentes.push({
                    "Cliente": cliente?.nome || 'Removido',
                    "Telefone": cliente?.telefone || '-',
                    "Parcela": p.numero,
                    "Vencimento": formatDate(p.vencimento),
                    "Dias Atraso": status.diasAtraso || 0,
                    "Valor Original (R$)": p.valorBase,
                    "Multa (R$)": multa,
                    "Total Devido (R$)": p.valorBase + multa,
                    "Status": status.label
                });
            }
        });
    });

    if (inadimplentes.length === 0) {
        showToast("Nenhum inadimplente pendente.");
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(inadimplentes);
    XLSX.utils.book_append_sheet(wb, ws, "Inadimplência");
    XLSX.writeFile(wb, `Relatorio_Inadimplencia_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Relatório de inadimplência exportado!");
    closeModal('modal-relatorios');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const [ano, mes, dia] = dateString.split('-');
    return `${dia}/${mes}/${ano}`;
}

function showToast(msg, type) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Auto-detect type from message content if not specified
    if (!type) {
        const lower = msg.toLowerCase();
        if (lower.includes('erro') || lower.includes('falha') || lower.includes('bloqueado') || lower.includes('insuficiente') || lower.includes('?'))
            type = 'error';
        else if (lower.includes('atenção') || lower.includes('aviso') || lower.includes('cuidado'))
            type = 'warning';
        else if (lower.includes('info') || lower.includes('tema'))
            type = 'info';
        else
            type = 'success';
    }

    // Configure toast variant
    const configs = {
        success: { icon: 'check', label: '? Sucesso', cls: '', iconCls: 'from-emerald-500 to-teal-500', labelCls: 'text-emerald-400' },
        error: { icon: 'x', label: '? Erro', cls: 'toast-error', iconCls: 'from-red-500 to-rose-500', labelCls: 'text-red-400' },
        warning: { icon: 'alert-triangle', label: '? Atenção', cls: 'toast-warning', iconCls: 'from-amber-500 to-orange-500', labelCls: 'text-amber-400' },
        info: { icon: 'info', label: '? Info', cls: 'toast-info', iconCls: 'from-blue-500 to-indigo-500', labelCls: 'text-blue-400' }
    };
    const cfg = configs[type] || configs.success;

    // Reset classes
    toast.classList.remove('toast-error', 'toast-warning', 'toast-info');
    if (cfg.cls) toast.classList.add(cfg.cls);

    // Update icon
    const iconWrap = toast.querySelector('.toast-icon-wrap') || toast.querySelector('.bg-gradient-to-br');
    if (iconWrap) {
        iconWrap.className = `toast-icon-wrap bg-gradient-to-br ${cfg.iconCls} rounded-xl p-2 shadow-lg`;
        iconWrap.innerHTML = `<i data-lucide="${cfg.icon}" class="w-4 h-4 text-white"></i>`;
    }

    // Update label and message
    const labelEl = toast.querySelector('.text-emerald-400, .text-red-400, .text-amber-400, .text-blue-400, [class*="text-"][class*="font-bold"][class*="uppercase"]');
    if (labelEl) {
        labelEl.className = `text-[10px] ${cfg.labelCls} font-bold uppercase tracking-wider mb-0.5`;
        labelEl.textContent = cfg.label;
    }

    document.getElementById('toast-message').innerText = msg;

    // -- Auto-dismiss progress bar --
    const duration = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
    let progressBar = toast.querySelector('.toast-progress');
    if (progressBar) progressBar.remove();
    progressBar = document.createElement('div');
    progressBar.className = 'toast-progress';
    progressBar.style.setProperty('--toast-duration', duration + 'ms');
    toast.style.position = 'relative';
    toast.appendChild(progressBar);

    // Animate in
    toast.classList.remove('translate-y-24', 'opacity-0');
    if (typeof lucide !== 'undefined') refreshIcons();

    // Auto-dismiss
    clearTimeout(toast._dismissTimer);
    toast._dismissTimer = setTimeout(() => toast.classList.add('translate-y-24', 'opacity-0'), duration);
}

function filterTable(tableId, colIndex, text) {
    const filter = text.toLowerCase();
    const rows = document.getElementById(tableId).getElementsByTagName('tr');
    for (let i = 1; i < rows.length; i++) {
        let td = rows[i].getElementsByTagName('td')[colIndex];
        if (td) {
            rows[i].style.display = (td.textContent || td.innerText).toLowerCase().indexOf(filter) > -1 ? "" : "none";
        }
    }
}
