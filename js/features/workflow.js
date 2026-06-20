// SEÇÃO — TOGGLE STATUS CLIENTE (Ativo ? Inativo com senha mestre)
function toggleClienteStatus(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const statusAtual = cliente.status || 'ativo';

    if (statusAtual === 'ativo') {
        // Bloquear — não precisa de senha
        if (!confirm(`Deseja BLOQUEAR o cliente "${cliente.nome}"?\n\nEle ficará INATIVO e não poderá receber novos empréstimos.\nPara reativar será necessária a senha mestre.`)) return;
        cliente.status = 'inativo';
        persistCliente(cliente);
        showToast(`Cliente "${cliente.nome}" bloqueado com sucesso.`);
        _sortedClientesCacheVersion = -1; // invalida cache
        _updateClientesTable();
    } else {
        // Reativar — exige senha mestre via modal
        window._reativarClienteId = clienteId;
        document.getElementById('senha-mestre-input').value = '';
        document.getElementById('senha-mestre-erro').classList.add('hidden');
        document.getElementById('senha-mestre-msg').textContent = `Cliente "${cliente.nome}" está INATIVO. Digite a senha mestre para reativar.`;
        document.getElementById('modal-senha-mestre').showModal();
    }
}

async function confirmarSenhaMestre(event) {
    event.preventDefault();
    const senha = document.getElementById('senha-mestre-input').value;
    let autorizado = false;
    try {
        const result = await window.db.verifyMasterPassword(senha);
        autorizado = !!result?.success;
    } catch (error) {
        console.warn('[workflow] Falha ao validar senha mestre:', error.message);
    }
    if (autorizado) {
        const cliente = state.clientes.find(c => c.id === window._reativarClienteId);
        if (cliente) {
            cliente.status = 'ativo';
            persistCliente(cliente);
            showToast(`Cliente "${cliente.nome}" reativado com sucesso!`);
            _sortedClientesCacheVersion = -1;
            _updateClientesTable();
        }
        closeModal('modal-senha-mestre');
        window._reativarClienteId = null;
    } else {
        document.getElementById('senha-mestre-erro').classList.remove('hidden');
    }
}

// SEÇÃO — WORKFLOW DE APROVAÇÃO DE CONTRATOS
async function alterarAprovacao(novoStatus) {
    if (!currentLoanId) return;
    const emp = state.emprestimos.find(e => e.id === currentLoanId);
    if (!emp) return;

    const statusAnterior = emp.aprovacao || 'aprovado';
    if (statusAnterior === novoStatus) return;

    const cliente = state.clientes.find(c => c.id === emp.clienteId);
    const nomeCliente = cliente ? cliente.nome : 'Cliente';

    // Caixa já foi debitado se contrato está aprovado OU arquivado (impresso).
    // Considerar ambos como "já tem saída registrada" pra evitar dupla-débito.
    const caixaJaDebitado = (statusAnterior === 'aprovado' || statusAnterior === 'arquivado');

    // CASO 1: Indo PARA aprovado, vindo de status SEM débito (em_analise/reprovado)
    if (novoStatus === 'aprovado' && !caixaJaDebitado) {
        if (state.caixa.saldo < emp.valorOriginal) {
            alert('Saldo em caixa insuficiente para aprovar este contrato.\nAdicione capital antes de aprovar.');
            document.getElementById('det-aprovacao-select').value = statusAnterior;
            return;
        }
        if (!confirm(`Aprovar contrato de ${nomeCliente}?\n\nValor: ${formatMoney(emp.valorOriginal)}\nSerá debitado do caixa imediatamente.`)) {
            document.getElementById('det-aprovacao-select').value = statusAnterior;
            return;
        }
        emp.aprovacao = 'aprovado';
        const empResult = await persistEmprestimo(emp);
        if (!empResult?.success) {
            emp.aprovacao = statusAnterior;
            showToast('Erro ao salvar aprovação do contrato.', 'error');
            document.getElementById('det-aprovacao-select').value = statusAnterior;
            return;
        }
        showToast(`Contrato de ${nomeCliente} APROVADO! R$ ${emp.valorOriginal.toFixed(2)} debitado do caixa.`);
    }
    // CASO 2: Indo PARA aprovado, vindo de ARQUIVADO (já tinha saído do caixa).
    // Apenas reverte o status, sem mexer no caixa.
    else if (novoStatus === 'aprovado' && statusAnterior === 'arquivado') {
        if (!confirm(`Desarquivar contrato de ${nomeCliente} e voltar para "Aprovado"?\n\nO valor não será debitado novamente (já tinha sido na aprovação inicial).`)) {
            document.getElementById('det-aprovacao-select').value = statusAnterior;
            return;
        }
        emp.aprovacao = 'aprovado';
        await persistEmprestimo(emp);
        showToast(`Contrato desarquivado e reaberto como APROVADO. Caixa não foi alterado.`);
    }
    // CASO 3: Saindo de aprovado/arquivado para em_analise/reprovado — estornar caixa.
    else if (caixaJaDebitado && novoStatus !== 'aprovado' && novoStatus !== 'arquivado') {
        const temPago = emp.parcelas.some(p => p.status === 'pago');
        if (temPago) {
            alert('Este contrato já possui parcelas pagas.\nNão é possível alterar o status de aprovação.');
            document.getElementById('det-aprovacao-select').value = statusAnterior;
            return;
        }
        const labelNovo = novoStatus === 'em_analise' ? 'Em Análise' : 'Reprovado';
        if (!confirm(`Mover contrato de ${nomeCliente} para "${labelNovo}"?\n\nO valor de ${formatMoney(emp.valorOriginal)} será devolvido ao caixa.`)) {
            document.getElementById('det-aprovacao-select').value = statusAnterior;
            return;
        }
        emp.aprovacao = novoStatus;
        const empResult = await persistEmprestimo(emp);
        if (!empResult?.success) {
            emp.aprovacao = statusAnterior;
            showToast('Erro ao salvar mudança de aprovação.', 'error');
            document.getElementById('det-aprovacao-select').value = statusAnterior;
            return;
        }
        showToast(`Contrato movido para ${labelNovo}. Valor estornado ao caixa.`);
    }
    // CASO 4: Mudando entre em_analise e reprovado (nenhum dos dois debitou o caixa)
    else {
        const labelNovo = novoStatus === 'em_analise' ? 'Em Análise' : 'Reprovado';
        emp.aprovacao = novoStatus;
        await persistEmprestimo(emp);
        showToast(`Contrato movido para ${labelNovo}.`);
    }

    // Atualizar badge no modal (sem emojis literais que aparecem como ?)
    const badgeAprov = document.getElementById('det-aprovacao-badge');
    if (badgeAprov) {
        if (novoStatus === 'aprovado') {
            badgeAprov.className = 'badge bg-emerald-100 text-emerald-700 border border-emerald-200';
            badgeAprov.innerHTML = 'Aprovado';
        } else if (novoStatus === 'em_analise') {
            badgeAprov.className = 'badge bg-amber-100 text-amber-700 border border-amber-200';
            badgeAprov.innerHTML = 'Em Análise';
        } else if (novoStatus === 'arquivado') {
            badgeAprov.className = 'badge bg-slate-200 text-slate-700 border border-slate-300';
            badgeAprov.innerHTML = 'Aprovado (Impresso)';
        } else {
            badgeAprov.className = 'badge bg-red-100 text-red-700 border border-red-200';
            badgeAprov.innerHTML = 'Reprovado';
        }
    }
    updateUI();
}

// SEÇÃO — FOTO DO CLIENTE (Modal Inteligência Financeira)
function handleClienteFoto(event) {
    const file = event.target.files[0];
    if (!file || !_currentAnalystClientId) return;

    // Limitar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('A foto deve ter no máximo 2MB.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64 = e.target.result;

        // Atualizar no state
        const cliente = state.clientes.find(c => c.id === _currentAnalystClientId);
        if (!cliente) return;
        cliente.foto = base64;
        persistCliente(cliente);

        // Atualizar UI do modal
        const fotoImg = document.getElementById('ai-foto-img');
        const fotoLetter = document.getElementById('ai-foto-letter');
        fotoImg.src = base64;
        fotoImg.classList.remove('hidden');
        fotoLetter.classList.add('hidden');

        showToast('Foto do cliente salva!');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

// SEÇÃO: TOGGLE CAMPOS TRANSFERÊNCIA / PIX
function toggleTransferenciaFields() {
    const tipo = document.getElementById('cliente-tipo-pag').value;
    const camposBanco = document.getElementById('campos-banco');
    const camposPix = document.getElementById('campos-pix');
    if (tipo === 'ted') {
        camposBanco.classList.remove('hidden');
        camposPix.classList.add('hidden');
    } else if (tipo === 'pix') {
        camposBanco.classList.add('hidden');
        camposPix.classList.remove('hidden');
    } else {
        camposBanco.classList.add('hidden');
        camposPix.classList.add('hidden');
    }
}

function toggleBancoOutro() {
    const sel = document.getElementById('cliente-banco').value;
    const campoOutro = document.getElementById('campo-banco-outro');
    if (sel === 'outro') {
        campoOutro.classList.remove('hidden');
    } else {
        campoOutro.classList.add('hidden');
        document.getElementById('cliente-banco-outro').value = '';
    }
}

// SEÇÃO: RELATÓRIO IMPRIMÍVEL DE APROVADOS
async function imprimirRelatorioAprovados() {
    const aprovados = state.emprestimos.filter(e => (e.aprovacao || 'aprovado') === 'aprovado' && e.statusGeral === 'ativo');
    if (aprovados.length === 0) { showToast('Nenhum contrato aprovado para imprimir.'); return; }

    const config = state.config || {};
    const nomeEmpresa = config.empresaNome || config.nomeEmpresa || 'CredGestor';
    const nomeEmpresaHtml = S(nomeEmpresa);
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const printCfg = getPrintConfig();

    let rows = '';
    let thermalRows = '';
    aprovados.forEach((emp, i) => {
        const cliente = getClienteById(emp.clienteId);
        if (!cliente) return;
        let transferencia = '—';
        if (cliente.tipoPagamento === 'ted') {
            transferencia = `Banco: ${S(cliente.banco || '—')} | Ag: ${S(cliente.agencia || '—')} | Op: ${S(cliente.operacao || '—')} | Conta: ${S(cliente.conta || '—')}`;
        } else if (cliente.tipoPagamento === 'pix') {
            transferencia = `PIX: ${S(cliente.chavePix || '—')}`;
        }
        rows += `
            <tr>
                <td style="border:1px solid #ccc;padding:8px 12px;text-align:center;font-weight:600;">${i + 1}</td>
                <td style="border:1px solid #ccc;padding:8px 12px;">${S(cliente.nome)}</td>
                <td style="border:1px solid #ccc;padding:8px 12px;font-family:monospace;">${S(cliente.cpf || '—')}</td>
                <td style="border:1px solid #ccc;padding:8px 12px;font-size:11px;">${transferencia}</td>
                <td style="border:1px solid #ccc;padding:8px 12px;text-align:right;font-weight:700;">${formatMoney(emp.valorOriginal)}</td>
                <td style="border:1px solid #ccc;padding:8px 16px;text-align:center;">
                    <span style="display:inline-block;width:18px;height:18px;border:2px solid #333;border-radius:3px;"></span>
                </td>
                <td style="border:1px solid #ccc;padding:8px 16px;text-align:center;">
                    <span style="display:inline-block;width:18px;height:18px;border:2px solid #333;border-radius:3px;"></span>
                </td>
            </tr>`;
        thermalRows += `
            <div class="item">
                <div class="line"><strong>#${i + 1} ${S(cliente.nome)}</strong></div>
                <div class="line">CPF: ${S(cliente.cpf || '—')}</div>
                <div class="line">Valor: <strong>${formatMoney(emp.valorOriginal)}</strong></div>
                <div class="line small">${transferencia}</div>
                <div class="checks"><span>[ ] Feito</span><span>[ ] Nao feito</span></div>
            </div>`;
    });

    const html = printCfg.thermal ? `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Relatório de Aprovados</title>
<style>
    @page { size: ${printCfg.widthMm}mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 0; width: ${Math.max(48, printCfg.widthMm - 6)}mm; font-size: 10px; }
    .header { text-align: center; border-bottom: 1px dashed #111827; padding-bottom: 6px; margin-bottom: 6px; }
    .header h1 { font-size: 13px; margin: 0 0 3px; }
    .header p { margin: 1px 0; font-size: 9px; }
    .item { border-bottom: 1px dashed #9ca3af; padding: 6px 0; page-break-inside: avoid; }
    .line { margin: 2px 0; overflow-wrap: anywhere; }
    .small { font-size: 8px; color: #374151; }
    .checks { display: flex; justify-content: space-between; gap: 6px; margin-top: 5px; font-size: 9px; }
    .footer { text-align: center; margin-top: 8px; border-top: 1px dashed #111827; padding-top: 6px; font-size: 8px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="header">
    <h1>${nomeEmpresaHtml}</h1>
    <p>Contratos Aprovados</p>
    <p>${dataHoje} · ${aprovados.length} contrato(s)</p>
</div>
${thermalRows}
<div class="footer">Documento para controle interno</div>
</body></html>` : `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Relatório de Aprovados</title>
<style>
    @page { size: A4 landscape; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 20px; margin: 0; color: #064e3b; }
    .header p { font-size: 12px; color: #64748b; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #0f172a; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #ecfdf5; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    .assinatura { margin-top: 60px; display: flex; justify-content: space-around; }
    .assinatura div { text-align: center; width: 250px; }
    .assinatura .linha { border-top: 1px solid #333; margin-bottom: 4px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="header">
    <div>
        <h1>${nomeEmpresaHtml}</h1>
        <p>Relatório de Contratos Aprovados para Depósito</p>
    </div>
    <div style="text-align:right;">
        <p><strong>Data:</strong> ${dataHoje}</p>
        <p><strong>Total:</strong> ${aprovados.length} contrato(s)</p>
    </div>
</div>
<table>
    <thead>
        <tr>
            <th style="width:40px;text-align:center;">#</th>
            <th>Nome do Cliente</th>
            <th>CPF / CNPJ</th>
            <th>Dados Bancários / PIX</th>
            <th style="text-align:right;">Valor</th>
            <th style="width:60px;text-align:center;">Feito</th>
            <th style="width:70px;text-align:center;">Não Feito</th>
        </tr>
    </thead>
    <tbody>${rows}</tbody>
</table>
<div class="assinatura">
    <div><div class="linha"></div><span style="font-size:11px;color:#475569;">Assinatura do Analista</span></div>
    <div><div class="linha"></div><span style="font-size:11px;color:#475569;">Assinatura do Gestor</span></div>
</div>
<div class="footer">
    <span>Gerado por ${nomeEmpresaHtml} — ${dataHoje}</span>
    <span>Documento para controle interno</span>
</div>
</body></html>`;

    // ── PRIMEIRO: arquivar + persistir ANTES de imprimir. Assim, mesmo se o ──
    // usuário cancelar o diálogo de impressão ou ocorrer erro no iframe, o ──
    // registro de aprovados não se perde.
    const agora = new Date();
    const registro = {
        id: String(Date.now()),
        dataImpressao: agora.toLocaleDateString('pt-BR'),
        horaImpressao: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: agora.toISOString(),
        contratos: aprovados.map(emp => {
            const cli = getClienteById(emp.clienteId);
            let transferencia = '—';
            if (cli && cli.tipoPagamento === 'ted') {
                transferencia = `Banco: ${cli.banco || '—'} | Ag: ${cli.agencia || '—'} | Op: ${cli.operacao || '—'} | Conta: ${cli.conta || '—'}`;
            } else if (cli && cli.tipoPagamento === 'pix') {
                transferencia = `PIX: ${cli.chavePix || '—'}`;
            }
            return {
                empId: emp.id,
                clienteNome: cli ? cli.nome : 'Desconhecido',
                clienteCpf: cli ? (cli.cpf || '—') : '—',
                transferencia,
                valor: emp.valorOriginal,
                parcelas: emp.parcelas ? emp.parcelas.length : 0
            };
        })
    };

    if (!Array.isArray(state.arquivoAprovados)) state.arquivoAprovados = [];
    state.arquivoAprovados.unshift(registro);
    aprovados.forEach(emp => { emp.aprovacao = 'arquivado'; });

    try {
        for (const emp of aprovados) {
            await persistEmprestimo(emp);
        }
        await saveData();
        console.log('[ARQUIVO_APROVADOS] registro persistido:', registro.id, 'total=', state.arquivoAprovados.length);

        // Cria recibos de entrega (status=pendente) para cada contrato do lote.
        // Cada recibo ganha número sequencial REC-YYYY-NNNNNN e fica vinculado ao
        // arquivo_aprovado pra rastreabilidade total.
        try {
            const contratosParaRecibo = aprovados.map(emp => {
                const cli = getClienteById(emp.clienteId);
                let transferencia = '—';
                if (cli && cli.tipoPagamento === 'ted') {
                    transferencia = `Banco: ${cli.banco || '—'} | Ag: ${cli.agencia || '—'} | Op: ${cli.operacao || '—'} | Conta: ${cli.conta || '—'}`;
                } else if (cli && cli.tipoPagamento === 'pix') {
                    transferencia = `PIX: ${cli.chavePix || '—'}`;
                }
                return {
                    empId: emp.id,
                    clienteId: cli ? cli.id : '',
                    clienteNome: cli ? cli.nome : 'Desconhecido',
                    clienteCpf: cli ? (cli.cpf || '—') : '—',
                    clienteTelefone: cli ? (cli.telefone || '') : '',
                    transferencia,
                    valor: emp.valorOriginal,
                    parcelas: emp.parcelas ? emp.parcelas.length : 0,
                };
            });
            if (window.db && typeof window.db.criarRecibosArquivo === 'function') {
                const r = await window.db.criarRecibosArquivo(registro.id, contratosParaRecibo);
                if (r && r.success) {
                    console.log(`[RECIBOS] ${r.criados.length} recibos criados para arquivo ${registro.id}`);
                }
            }
        } catch (recErr) {
            console.warn('[RECIBOS] Falha ao criar recibos (não crítico):', recErr?.message || recErr);
        }

        showToast(`${aprovados.length} contrato(s) arquivado(s) em "Arquivo de Aprovados".`);
    } catch (err) {
        console.error('[ARQUIVO_APROVADOS] erro ao persistir:', err);
        showToast('Impressão concluída, mas houve erro ao salvar no arquivo de aprovados.', 'error');
    }

    // ── DEPOIS: disparar impressão ──
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1100px;height:700px;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            const printDiv = document.createElement('div');
            printDiv.id = 'print-overlay';
            printDiv.innerHTML = `<style>@media print{body>*:not(#print-overlay){display:none!important;}#print-overlay{display:block!important;}}</style>${html}`;
            document.body.appendChild(printDiv);
            window.print();
            try { document.body.removeChild(printDiv); } catch (error) { console.warn('[features] Falha ao remover overlay de impressao:', error.message); }
        }
        setTimeout(() => { try { document.body.removeChild(iframe); } catch (error) { console.warn('[features] Falha ao remover iframe de impressao:', error.message); } }, 2000);
    }, 500);

    setTimeout(() => { updateUI(); }, 300);
}

// SEÇÃO — ARQUIVO DE APROVADOS (Histórico de Impressões)
async function renderArquivoAprovados(container) {
    // Recarrega estado do banco local para garantir que a lista esteja sincronizada
    // após persistência em background (evita mostrar lista desatualizada por cache em memória).
    try {
        if (window.db && typeof window.db.loadState === 'function') {
            const fresh = await window.db.loadState();
            if (fresh && Array.isArray(fresh.arquivoAprovados)) {
                state.arquivoAprovados = fresh.arquivoAprovados;
            }
        }
    } catch (e) {
        console.warn('[ARQUIVO_APROVADOS] loadState falhou, usando cache em memória:', e?.message);
    }

    const arquivo = state.arquivoAprovados || [];

    if (arquivo.length === 0) {
        container.innerHTML = `
            <div class="space-y-6 fade-in">
                <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">Arquivo de Aprovados</h3>
                </div>
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-12 text-center">
                    <i data-lucide="archive" class="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4"></i>
                    <p class="text-slate-400 dark:text-slate-500 text-lg">Nenhum registro arquivado ainda.</p>
                    <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">Quando você imprimir a lista de aprovados (tela "Contratos Aprovados"), os contratos serão arquivados aqui.</p>
                </div>
            </div>`;
        refreshIcons();
        return;
    }

    // Para cada arquivo, busca os recibos vinculados (pendente/entregue/estornado).
    // Lotes sem recibo ainda podem gerar recibos retroativos.
    const recibosPorArquivo = {};
    if (window.db && typeof window.db.listarRecibosArquivo === 'function') {
        for (const reg of arquivo) {
            try {
                const recibos = await window.db.listarRecibosArquivo(reg.id);
                if (Array.isArray(recibos)) recibosPorArquivo[reg.id] = recibos;
            } catch (_) { /* ignora — fallback é usar contratos do arquivo */ }
        }
    }

    let blocos = '';
    arquivo.forEach((reg, idx) => {
        let totalValor = 0, totalEntregues = 0, totalPendentes = 0, totalEstornados = 0;
        let rows = '';
        const recibos = recibosPorArquivo[reg.id] || [];
        const temRecibos = recibos.length > 0;

        // Indexa recibos por empId para join rápido com reg.contratos
        const reciboPorEmp = new Map();
        for (const r of recibos) reciboPorEmp.set(String(r.emprestimoId || ''), r);

        reg.contratos.forEach((c, i) => {
            totalValor += c.valor || 0;
            const recibo = reciboPorEmp.get(String(c.empId || '')) || null;
            const status = recibo ? recibo.status : 'pendente';
            if (status === 'entregue') totalEntregues++;
            else if (status === 'estornado') totalEstornados++;
            else totalPendentes++;

            const badgeStatus = status === 'entregue'
                ? `<span class="badge bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px]">ENTREGUE</span>`
                : status === 'estornado'
                ? `<span class="badge bg-red-100 text-red-700 border border-red-200 text-[9px]">ESTORNADO</span>`
                : `<span class="badge bg-amber-100 text-amber-700 border border-amber-200 text-[9px]">PENDENTE</span>`;

            const numero = recibo ? `<span class="font-mono text-[10px] text-slate-400">${S(recibo.numeroRecibo)}</span>` : '';
            const checkbox = (recibo && status === 'pendente')
                ? `<input type="checkbox" class="recibo-checkbox" data-recibo-id="${S(recibo.id)}" data-arquivo-id="${S(reg.id)}">`
                : '<span class="inline-block w-4"></span>';

            const acoes = recibo ? (
                status === 'pendente'
                    ? `<button onclick="marcarReciboEntregueUnit('${S(recibo.id)}','${S(reg.id)}')" class="px-2 py-1 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded">Entregar</button>`
                    : status === 'entregue'
                    ? `<button onclick="abrirModalEstornoRecibo('${S(recibo.id)}','${S(reg.id)}')" class="px-2 py-1 text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 rounded">Estornar</button>`
                    : `<span class="text-[10px] text-slate-400">—</span>`
            ) : `<button onclick="gerarRecibosRetroativos('${S(reg.id)}')" class="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded" title="Cria recibos para este lote arquivado">Gerar recibos</button>`;

            const opEntrega = recibo && status === 'entregue'
                ? `<div class="text-[9px] text-slate-400 mt-1">${S(recibo.operadorNome || '—')} · ${S((recibo.dataEntrega || '').replace('T', ' ').slice(0, 16))}</div>`
                : '';

            rows += `
                <tr class="${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/30'} ${status === 'estornado' ? 'opacity-60' : ''}">
                    <td class="px-3 py-3 text-center w-8">${checkbox}</td>
                    <td class="px-3 py-3 text-center text-slate-500 dark:text-slate-400 font-semibold">${i + 1}</td>
                    <td class="px-3 py-3 text-slate-800 dark:text-slate-200 font-medium">
                        ${S(c.clienteNome)}
                        ${numero ? '<div>' + numero + '</div>' : ''}
                        ${opEntrega}
                    </td>
                    <td class="px-3 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">${S(c.clienteCpf)}</td>
                    <td class="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs">${S(c.transferencia)}</td>
                    <td class="px-3 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">${formatMoney(c.valor)}</td>
                    <td class="px-3 py-3 text-center">${badgeStatus}</td>
                    <td class="px-3 py-3 text-right">${acoes}</td>
                </tr>`;
        });

        const acoesLote = temRecibos && totalPendentes > 0 ? `
            <button onclick="marcarRecibosLoteEntregues('${S(reg.id)}')"
                class="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                <i data-lucide="check-square" class="w-3.5 h-3.5"></i> Marcar selecionados como entregues
            </button>` : '';

        const resumoStatus = temRecibos ? `
            <div class="flex flex-wrap items-center gap-1.5 mt-2">
                ${totalPendentes > 0 ? `<span class="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">${totalPendentes} pendente(s)</span>` : ''}
                ${totalEntregues > 0 ? `<span class="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">${totalEntregues} entregue(s)</span>` : ''}
                ${totalEstornados > 0 ? `<span class="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">${totalEstornados} estornado(s)</span>` : ''}
            </div>` : '';

        blocos += `
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden mb-6" data-arquivo-id="${S(reg.id)}">
                <div class="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h4 class="text-white font-bold text-base">Impressão #${arquivo.length - idx}</h4>
                        <p class="text-teal-100 text-sm mt-0.5">
                            <i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i> Data: ${S(reg.dataImpressao)}
                            &nbsp;&nbsp;
                            <i data-lucide="clock" class="w-3.5 h-3.5 inline mr-1"></i> Hora: ${S(reg.horaImpressao)}
                        </p>
                        ${resumoStatus}
                    </div>
                    <div class="text-right">
                        <span class="text-white text-sm font-semibold">${reg.contratos.length} contrato(s)</span>
                        <p class="text-teal-100 text-sm font-bold">${formatMoney(totalValor)}</p>
                        ${acoesLote}
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-50/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-600">
                            <tr>
                                <th class="px-3 py-3 text-center w-8">
                                    ${temRecibos ? '<input type="checkbox" onclick="toggleTodosRecibosLote(this,\'' + S(reg.id) + '\')">' : ''}
                                </th>
                                <th class="px-3 py-3 text-center w-12">#</th>
                                <th class="px-3 py-3">Cliente / Recibo</th>
                                <th class="px-3 py-3">CPF</th>
                                <th class="px-3 py-3">Dados Bancários / PIX</th>
                                <th class="px-3 py-3 text-right">Valor</th>
                                <th class="px-3 py-3 text-center">Status</th>
                                <th class="px-3 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    });

    container.innerHTML = `
        <div class="space-y-6 fade-in">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">Arquivo de Aprovados <span class="text-sm font-normal text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full ml-2">${arquivo.length} impressão(ões)</span></h3>
            </div>
            ${blocos}
        </div>`;
    refreshIcons();
}

// ─── AÇÕES SOBRE RECIBOS DE ENTREGA ─────────────────────────────────

function _operadorAtual() {
    // Tenta admin user (gerencia usuários backend); fallback no nome do gestor local
    let nome = '', email = '';
    try {
        const adminUserRaw = localStorage.getItem('adminUser');
        if (adminUserRaw) {
            const u = JSON.parse(adminUserRaw);
            nome = u?.nome || u?.name || '';
            email = u?.email || '';
        }
    } catch (error) {
        console.warn('[features] adminUser invalido no armazenamento:', error.message);
    }
    if (!nome && typeof getGestorName === 'function') {
        try { nome = getGestorName() || ''; } catch (error) { console.warn('[features] Falha ao resolver nome do gestor:', error.message); }
    }
    return { nome: nome || 'Gestor', email };
}

function toggleTodosRecibosLote(checkbox, arquivoId) {
    const inputs = document.querySelectorAll(
        `[data-arquivo-id="${arquivoId}"] .recibo-checkbox`
    );
    inputs.forEach(inp => { inp.checked = !!checkbox.checked; });
}

async function marcarReciboEntregueUnit(reciboId, arquivoId) {
    if (!confirm('Confirmar entrega deste empréstimo? Será gerado um recibo PDF local.')) return;
    const op = _operadorAtual();
    try {
        const res = await window.db.marcarReciboEntregue({
            reciboId, operadorNome: op.nome, operadorEmail: op.email, observacao: '', pdfHash: ''
        });
        if (!res || res.success !== true) throw new Error(res?.error || 'Falha');
        showToast(`Recibo ${res.recibo?.numeroRecibo || ''} marcado como ENTREGUE.`);
        // Gera PDF local em background.
        _processarPdfEEnvioRecibo(res.recibo).catch(e => console.error('[RECIBO] erro PDF:', e));
        // Recarrega a tela
        const content = document.getElementById('app-content');
        if (content) renderArquivoAprovados(content);
    } catch (err) {
        showToast(`Erro ao marcar recibo: ${err?.message || err}`, 'error');
    }
}

async function marcarRecibosLoteEntregues(arquivoId) {
    const inputs = document.querySelectorAll(
        `[data-arquivo-id="${arquivoId}"] .recibo-checkbox:checked`
    );
    if (inputs.length === 0) {
        showToast('Selecione pelo menos um recibo (caixa à esquerda da linha).');
        return;
    }
    if (!confirm(`Marcar ${inputs.length} recibo(s) selecionado(s) como ENTREGUES?\n\nSerão gerados PDFs locais.`)) return;

    const op = _operadorAtual();
    let sucessos = 0, falhas = 0;
    const recibosOk = [];
    for (const inp of inputs) {
        const reciboId = inp.dataset.reciboId;
        try {
            const res = await window.db.marcarReciboEntregue({
                reciboId, operadorNome: op.nome, operadorEmail: op.email, observacao: '', pdfHash: ''
            });
            if (res && res.success) { sucessos++; if (res.recibo) recibosOk.push(res.recibo); }
            else falhas++;
        } catch (_) { falhas++; }
    }
    showToast(`${sucessos} marcado(s) como entregue. ${falhas > 0 ? falhas + ' falha(s).' : ''}`, falhas > 0 ? 'warning' : 'success');

    // Background: gera PDF local para cada recibo.
    for (const r of recibosOk) {
        try { await _processarPdfEEnvioRecibo(r); } catch (e) { console.error('[RECIBO LOTE]', e); }
    }
    const content = document.getElementById('app-content');
    if (content) renderArquivoAprovados(content);
}

function abrirModalEstornoRecibo(reciboId, arquivoId) {
    const just = prompt('Justificativa do estorno (mín. 5 caracteres):');
    if (!just || just.trim().length < 5) {
        if (just !== null) showToast('Justificativa muito curta — estorno cancelado.', 'warning');
        return;
    }
    const op = _operadorAtual();
    window.db.estornarRecibo({
        reciboId, operadorNome: op.nome, operadorEmail: op.email, justificativa: just.trim()
    }).then(res => {
        if (res && res.success) {
            showToast('Recibo estornado.');
            const content = document.getElementById('app-content');
            if (content) renderArquivoAprovados(content);
        } else {
            showToast('Erro ao estornar: ' + (res?.error || 'desconhecido'), 'error');
        }
    });
}

// Reenvio via WhatsApp removido no modo offline local

// ─── GERAR RECIBOS RETROATIVOS ──────────────────────────────────────
async function gerarRecibosRetroativos(arquivoId) {
    if (!confirm('Gerar recibos para este lote arquivado?\n\nCada contrato deste arquivo ganhará um número de recibo (REC-...) e ficará pendente para você marcar como entregue.')) return;
    try {
        const arquivo = (state.arquivoAprovados || []).find(a => a.id === arquivoId);
        if (!arquivo) throw new Error('Arquivo não encontrado em memória');
        if (!Array.isArray(arquivo.contratos) || arquivo.contratos.length === 0) {
            showToast('Lote sem contratos para gerar recibos.', 'warning');
            return;
        }

        // Enriquecer contratos com clienteId / telefone para recibos locais.
        const contratosEnrich = arquivo.contratos.map(c => {
            const cli = state.clientes.find(cl => String(cl.id) === String(c.empId));
            // empId aqui é id do empréstimo; precisamos achar o cliente via emp
            const emp = state.emprestimos.find(e => String(e.id) === String(c.empId));
            const clienteReal = emp ? state.clientes.find(cl => String(cl.id) === String(emp.clienteId)) : null;
            return {
                empId: c.empId,
                clienteId: clienteReal ? clienteReal.id : '',
                clienteNome: c.clienteNome || (clienteReal ? clienteReal.nome : ''),
                clienteCpf: c.clienteCpf || (clienteReal ? clienteReal.cpf : ''),
                clienteTelefone: clienteReal ? (clienteReal.telefone || '') : '',
                transferencia: c.transferencia || '',
                valor: c.valor || 0,
                parcelas: c.parcelas || 1,
            };
        });

        const r = await window.db.criarRecibosArquivo(arquivoId, contratosEnrich);
        if (!r || r.success !== true) throw new Error(r?.error || 'Falha ao criar recibos');
        showToast(`${r.criados.length} recibo(s) gerado(s) com sucesso!`);
        const content = document.getElementById('app-content');
        if (content) renderArquivoAprovados(content);
    } catch (err) {
        console.error('[RECIBOS_RETRO]', err);
        showToast('Erro: ' + (err?.message || err), 'error');
    }
}

// ─── EXCLUIR CONTRATO (zona de perigo no modal de pagamento) ─────────
// Remove o contrato e estorna ao caixa se status era aprovado/arquivado.
// Bloqueia se já tem parcelas pagas (preserva histórico contábil).
async function excluirContratoAtual() {
    if (!currentLoanId) return;
    const emp = state.emprestimos.find(e => e.id === currentLoanId);
    if (!emp) { showToast('Contrato não encontrado.', 'error'); return; }
    const cliente = state.clientes.find(c => c.id === emp.clienteId);
    const nomeCli = cliente ? cliente.nome : 'Cliente';

    const temPago = (emp.parcelas || []).some(p => p.status === 'pago');
    if (temPago) {
        alert(`Não é possível excluir.\n\nO contrato de ${nomeCli} já possui parcelas pagas e isso afetaria o histórico contábil. Se realmente precisa, primeiro estorne os pagamentos.`);
        return;
    }

    const status = emp.aprovacao || 'aprovado';
    const caixaJaDebitado = (status === 'aprovado' || status === 'arquivado');
    const valorEstorno = caixaJaDebitado ? Number(emp.valorOriginal) || 0 : 0;

    const msgConfirm = caixaJaDebitado
        ? `Excluir contrato de ${nomeCli}?\n\nValor: ${formatMoney(emp.valorOriginal)}\nStatus atual: ${status.toUpperCase()}\n\nO valor será ESTORNADO ao caixa antes da exclusão.\n\nESTA AÇÃO NÃO PODE SER DESFEITA.`
        : `Excluir contrato de ${nomeCli}?\n\nStatus atual: ${status.toUpperCase()}\nNenhum estorno será feito (não houve débito).\n\nESTA AÇÃO NÃO PODE SER DESFEITA.`;

    if (!confirm(msgConfirm)) return;
    const confirmacao = prompt('Para confirmar, digite EXCLUIR (em maiúsculas):');
    if (confirmacao !== 'EXCLUIR') {
        showToast('Exclusão cancelada.', 'warning');
        return;
    }

    try {
        // 1. Deletar do banco local. O backend estorna o caixa de forma transacional.
        if (window.db && typeof window.db.deleteEmprestimo === 'function') {
            const r = await window.db.deleteEmprestimo(emp.id);
            if (!r || r.success !== true) throw new Error(r?.error || r?.reason || 'Falha ao excluir');
            if (typeof syncCaixaFromPersistenceResult === 'function') syncCaixaFromPersistenceResult(r);
        }

        // 2. Remover do state em memória
        const idx = state.emprestimos.findIndex(e => e.id === emp.id);
        if (idx !== -1) state.emprestimos.splice(idx, 1);

        // 3. Fechar modal e atualizar
        closeModal('modal-pagamento');
        currentLoanId = null;
        showToast(`Contrato de ${nomeCli} excluído.${caixaJaDebitado ? ' Valor estornado ao caixa.' : ''}`);
        updateUI();
    } catch (err) {
        console.error('[EXCLUIR_CONTRATO]', err);
        showToast('Erro ao excluir: ' + (err?.message || err), 'error');
    }
}

// ─── PDF DO RECIBO LOCAL ─────────────────────────────────────────────
// Gera PDF localmente com jsPDF (offline-first), salva em disco no diretório
// escolhido pelo operador.

function _gerarPdfRecibo(recibo) {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) throw new Error('jsPDF não disponível');

    const empresaNome = (state.config?.empresaNome || 'CredGestor').slice(0, 80);
    const empresaTel = state.config?.empresaTelefone || '';
    const dataEntrega = (recibo.dataEntrega || new Date().toISOString()).replace('T', ' ').slice(0, 19);
    const hash = _hashSimples(`${recibo.numeroRecibo}|${recibo.valor}|${recibo.dataEntrega}|${recibo.clienteCpf}`);
    const printCfg = getPrintConfig();

    if (printCfg.thermal) {
        const W = printCfg.widthMm;
        const doc = new jsPDF({ unit: 'mm', format: [W, 190] });
        const pad = W <= 58 ? 3 : 4;
        let y = 7;

        doc.setFont('helvetica', 'bold').setFontSize(W <= 58 ? 9 : 10);
        doc.text(empresaNome.slice(0, 34), W / 2, y, { align: 'center' });
        y += 4;
        if (empresaTel) {
            doc.setFont('helvetica', 'normal').setFontSize(7);
            doc.text(String(empresaTel).slice(0, 32), W / 2, y, { align: 'center' });
            y += 4;
        }
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('RECIBO DE ENTREGA', W / 2, y, { align: 'center' });
        y += 4;
        doc.line(pad, y, W - pad, y);
        y += 5;

        const row = (label, value, bold = false) => {
            doc.setFont('helvetica', 'bold').setFontSize(7);
            doc.text(String(label).toUpperCase(), pad, y);
            y += 3.5;
            doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 10 : 8);
            const lines = doc.splitTextToSize(String(value || '-'), W - pad * 2);
            doc.text(lines, pad, y);
            y += lines.length * (bold ? 4.5 : 3.8) + 2;
        };

        row('Numero', recibo.numeroRecibo || '-');
        row('Cliente', `${recibo.clienteNome || '-'} ${recibo.clienteCpf ? '(' + recibo.clienteCpf + ')' : ''}`);
        row('Valor entregue', formatMoney(recibo.valor || 0), true);
        row('Parcelas', `${recibo.parcelas || 1}x`);
        row('Data da entrega', dataEntrega);
        row('Operador', recibo.operadorNome || '-');
        row('Transferencia', recibo.transferencia || '-');

        doc.line(pad, y, W - pad, y);
        y += 5;
        doc.setFont('courier', 'normal').setFontSize(6.5);
        doc.text(doc.splitTextToSize(`Hash: ${hash}`, W - pad * 2), pad, y);
        y += 7;
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text('Controle interno de entrega de valor.', W / 2, y, { align: 'center' });

        return { doc, hash };
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    // Cabeçalho com gradient simulado (faixa colorida)
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20).setFont('helvetica', 'bold');
    doc.text('RECIBO DE ENTREGA DE EMPRÉSTIMO', W / 2, 13, { align: 'center' });
    doc.setFontSize(10).setFont('helvetica', 'normal');
    doc.text(empresaNome + (empresaTel ? `  •  ${empresaTel}` : ''), W / 2, 22, { align: 'center' });

    // Box do número do recibo
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.roundedRect(W - 70, 38, 60, 14, 2, 2, 'FD');
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(9).setFont('helvetica', 'bold');
    doc.text('Nº DO RECIBO', W - 40, 43, { align: 'center' });
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(11);
    doc.text(recibo.numeroRecibo || '—', W - 40, 49, { align: 'center' });

    // Texto principal
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11).setFont('helvetica', 'normal');
    let y = 65;

    const linhasIntro = doc.splitTextToSize(
        `A empresa ${empresaNome} confirma a ENTREGA do empréstimo abaixo descrito ao cliente identificado, na data informada. Este documento serve como comprovante de saída do valor correspondente.`,
        W - 30
    );
    doc.text(linhasIntro, 15, y);
    y += linhasIntro.length * 5.5 + 6;

    // Bloco de dados — duas colunas
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(15, y, W - 30, 60, 2, 2, 'F');

    const left = 22, right = W / 2 + 5;
    let yy = y + 8;
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(100, 116, 139);
    doc.text('CLIENTE', left, yy);
    doc.text('CPF', right, yy);
    yy += 5;
    doc.setFontSize(11).setFont('helvetica', 'normal').setTextColor(15, 23, 42);
    doc.text(String(recibo.clienteNome || '—').slice(0, 50), left, yy);
    doc.text(String(recibo.clienteCpf || '—'), right, yy);

    yy += 10;
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(100, 116, 139);
    doc.text('VALOR ENTREGUE', left, yy);
    doc.text('PARCELAS', right, yy);
    yy += 5;
    doc.setFontSize(13).setFont('helvetica', 'bold').setTextColor(16, 185, 129);
    doc.text(formatMoney(recibo.valor || 0), left, yy);
    doc.setFontSize(11).setFont('helvetica', 'normal').setTextColor(15, 23, 42);
    doc.text(`${recibo.parcelas || 1}x`, right, yy);

    yy += 10;
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(100, 116, 139);
    doc.text('DATA DA ENTREGA', left, yy);
    doc.text('OPERADOR RESPONSÁVEL', right, yy);
    yy += 5;
    doc.setFontSize(11).setFont('helvetica', 'normal').setTextColor(15, 23, 42);
    doc.text(dataEntrega, left, yy);
    doc.text(String(recibo.operadorNome || '—').slice(0, 40), right, yy);

    y += 70;
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(100, 116, 139);
    doc.text('DADOS PARA TRANSFERÊNCIA', 15, y);
    y += 5;
    doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(15, 23, 42);
    const linhasTransf = doc.splitTextToSize(String(recibo.transferencia || '—'), W - 30);
    doc.text(linhasTransf, 15, y);
    y += linhasTransf.length * 5 + 8;

    // Rodapé com hash de autenticidade
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 270, W - 15, 270);
    doc.setFontSize(8).setTextColor(148, 163, 184);
    doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 276);
    doc.text(`Hash: ${hash}`, 15, 281);
    doc.text('Este recibo é controle interno entre a empresa e o cliente.', W - 15, 281, { align: 'right' });

    return { doc, hash };
}

// Hash simples para verificação básica de autenticidade do PDF (não criptográfico)
function _hashSimples(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h).toString(16).toUpperCase().padStart(8, '0');
}

async function _processarPdfEEnvioRecibo(recibo) {
    if (!recibo) return;
    try {
        const { doc, hash } = _gerarPdfRecibo(recibo);
        const filename = `recibo_${recibo.numeroRecibo}.pdf`;
        if (window.db?.marcarReciboWhatsapp) {
            await window.db.marcarReciboWhatsapp({
                reciboId: recibo.id,
                sucesso: false,
                erro: 'WhatsApp removido no modo offline'
            });
        }

        try {
            doc.save(filename);
        } catch (error) {
            console.warn('[features] Falha ao salvar PDF local do recibo:', error.message);
        }

        return { hash, filename };
    } catch (err) {
        console.error('[RECIBO PDF]', err);
        return null;
    }
}
