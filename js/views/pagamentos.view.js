// SEÇÃO 14  GESTÃO DE PAGAMENTOS
// openPaymentModal()   ? abre detalhes do contrato + parcelas
// renderInstallmentList() ? tabela de parcelas com status/multa
// pagarParcela()       ? marca parcela como paga + registra transação
// quitarTudo()         ? quita todas as parcelas pendentes
// gerarMensagemWhatsApp() ? gera recibo e abre WhatsApp
function openPaymentModal(id) {
    try {
        id = decodeURIComponent(String(id || ''));
    } catch (error) {
        console.warn('[views] Identificador de contrato codificado invalido:', error.message);
        return showToast('Identificador do contrato inválido.', 'error');
    }
    currentLoanId = id;
    const emp = state.emprestimos.find(e => e.id === id);
    if (!emp) return showToast('Contrato não encontrado.', 'error');
    const cliente = state.clientes.find(c => c.id === emp.clienteId);

    document.getElementById('det-cliente').innerText = cliente ? cliente.nome : 'Cliente Deletado';
    const _tiposForDet = (typeof getCreditTipos === 'function') ? getCreditTipos() : [];
    const _tipoCfgDet = _tiposForDet.find(t => t.key === normalizeContractType(emp.tipo));
    const _labelTipoDet = _tipoCfgDet ? _tipoCfgDet.label : emp.tipo;
    document.getElementById('det-tipo').innerText = `${String(_labelTipoDet).toUpperCase()} - Iniciado em ${formatDate(emp.dataInicio)}`;

    // Mostrar gestor responsóvel
    const divGestor = document.getElementById('det-gestor-info');
    if (emp.gestorResponsavel) {
        divGestor.classList.remove('hidden');
        document.getElementById('det-gestor-nome').innerText = emp.gestorResponsavel;
    } else {
        divGestor.classList.add('hidden');
    }

    const divAuth = document.getElementById('det-auth-info');
    if (emp.liberadoPor) {
        divAuth.classList.remove('hidden');
        document.getElementById('det-auth-nome').innerText = emp.liberadoPor;
    } else {
        divAuth.classList.add('hidden');
    }

    // Observação do contrato (banner acima do status de aprovação)
    const obsDisplay = document.getElementById('det-obs-display');
    const obsTexto = document.getElementById('det-obs-texto');
    const obsValor = (emp.obs || '').trim();
    if (obsDisplay && obsTexto) {
        if (obsValor) {
            obsTexto.textContent = obsValor;
            obsDisplay.classList.remove('hidden');
        } else {
            obsDisplay.classList.add('hidden');
            obsTexto.textContent = '';
        }
    }

    document.getElementById('det-principal').innerText = formatMoney(emp.valorOriginal);
    document.getElementById('det-total').innerText = formatMoney(emp.valorTotal);

    // Status de Aprovação — agora trata 'arquivado' como estado próprio (impresso)
    const aprovacao = emp.aprovacao || 'aprovado';
    const selectAprov = document.getElementById('det-aprovacao-select');
    const badgeAprov = document.getElementById('det-aprovacao-badge');
    if (selectAprov) {
        // Se for arquivado, deixa o select com valor 'aprovado' (estado lógico)
        // mas exibimos o badge "IMPRESSO". Operador pode mudar pra reprovado/em_analise
        // que estorna corretamente. Não há option 'arquivado' no select por design.
        selectAprov.value = (aprovacao === 'arquivado') ? 'aprovado' : aprovacao;
        if (emp.statusGeral === 'finalizado') {
            selectAprov.disabled = true;
        } else {
            selectAprov.disabled = false;
        }
    }
    if (badgeAprov) {
        if (aprovacao === 'aprovado') {
            badgeAprov.className = 'badge bg-emerald-100 text-emerald-700 border border-emerald-200';
            badgeAprov.innerHTML = 'Aprovado';
        } else if (aprovacao === 'em_analise') {
            badgeAprov.className = 'badge bg-amber-100 text-amber-700 border border-amber-200';
            badgeAprov.innerHTML = 'Em Análise';
        } else if (aprovacao === 'reprovado') {
            badgeAprov.className = 'badge bg-red-100 text-red-700 border border-red-200';
            badgeAprov.innerHTML = 'Reprovado';
        } else if (aprovacao === 'arquivado') {
            badgeAprov.className = 'badge bg-slate-200 text-slate-700 border border-slate-300';
            badgeAprov.innerHTML = '🗂️ Aprovado (Impresso)';
        } else {
            badgeAprov.className = 'badge bg-slate-100 text-slate-600 border border-slate-200';
            badgeAprov.textContent = aprovacao;
        }
    }

    renderInstallmentList(emp);
    const modal = document.getElementById('modal-pagamento');
    if (!modal.open) {
        modal.showModal();
    }
}

function renderInstallmentList(emp) {
    const tbody = document.getElementById('lista-parcelas');
    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    let totalRestante = 0;
    let totalMultaPrevista = 0;
    let todasPagas = true;
    const parcelas = emp.parcelas;
    for (let i = 0; i < parcelas.length; i++) {
        const p = parcelas[i];
        const row = document.createElement('tr');
        if (p.status === 'pendente') {
            todasPagas = false;
            totalRestante += p.valorBase;
            const status = getStatus(p.vencimento, null, emp.carenciaDias);
            const multa = calcularMulta(p.valorBase, status.diasAtraso || 0, emp.multaDiaria, emp.multaFixa, emp.carenciaDias) || 0;
            if (multa > 0) totalMultaPrevista += multa;
            row.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors';
            row.innerHTML = `
                <td class="px-5 py-4 font-bold text-slate-400 text-xs">#${p.numero}</td>
                <td class="px-5 py-4 text-slate-600 dark:text-slate-400">${formatDate(p.vencimento)}</td>
                <td class="px-5 py-4 font-bold text-slate-700 dark:text-slate-300">${formatMoney(p.valorBase)}</td>
                <td class="px-5 py-4 text-xs">
                    ${multa > 0 ? `<span class="text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">+ ${formatMoney(multa)}</span>` : '<span class="text-slate-300">-</span>'}
                </td>
                <td class="px-5 py-4"><span class="badge ${status.color}">${status.label}</span></td>
                <td class="px-5 py-4 text-right">
                    <button type="button" onclick="pagarParcela(${p.numero}, ${p.valorBase}, ${multa})" class="bg-brand-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-500 shadow-md shadow-brand-500/20 transition-all transform hover:-translate-y-0.5">
                        Receber
                    </button>
                </td>
            `;
        } else {
            row.className = 'bg-slate-50/50 dark:bg-slate-700/30 text-slate-400';
            row.innerHTML = `
                <td class="px-5 py-4 text-xs">#${p.numero}</td>
                <td class="px-5 py-4 line-through opacity-70">${formatDate(p.vencimento)}</td>
                <td class="px-5 py-4 line-through opacity-70">${formatMoney(p.valorBase)}</td>
                <td class="px-5 py-4 text-xs font-medium text-emerald-600">Pago + ${formatMoney(p.multaPaga)}</td>
                <td class="px-5 py-4"><span class="badge bg-green-100 text-green-700 border border-green-200 flex w-fit items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> PAGO</span></td>
                <td class="px-5 py-4 text-right text-xs">
                    <div class="flex justify-end gap-2">
                        <button onclick="gerarReciboPDF('${emp.id}', ${p.numero})" class="bg-cyan-500 hover:bg-cyan-600 text-white p-1.5 rounded-lg transition-colors shadow-sm" title="Baixar PDF do Recibo">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
        }
        fragment.appendChild(row);
    }
    tbody.appendChild(fragment);
    document.getElementById('det-restante').innerText = formatMoney(totalRestante);
    document.getElementById('det-multa').innerText = formatMoney(totalMultaPrevista);
    const btnQuitar = document.getElementById('btn-quitar');
    if (todasPagas) {
        btnQuitar.classList.add('hidden');
        if (emp.statusGeral !== 'finalizado') {
            emp.statusGeral = 'finalizado';
            persistEmprestimo(emp);
        }
    } else {
        btnQuitar.classList.remove('hidden');
    }
    refreshIcons();
}

async function pagarParcela(numeroParcela, valorBase, multaCalculada) {
    const total = valorBase + multaCalculada;
    if (confirm(`Confirmar recebimento da parcela #${numeroParcela}?\nValor: ${formatMoney(valorBase)}\nMulta: ${formatMoney(multaCalculada)}\nTotal: ${formatMoney(total)}`)) {
        const emp = state.emprestimos.find(e => e.id === currentLoanId);
        const parcela = emp.parcelas.find(p => p.numero === numeroParcela);
        const rollback = {
            parcela: { ...parcela },
            statusGeral: emp.statusGeral,
            caixaSaldo: state.caixa?.saldo || 0,
        };

        parcela.status = 'pago';
        parcela.dataPagamento = new Date().toISOString().split('T')[0];
        parcela.valorPago = total;
        parcela.multaPaga = multaCalculada;

        const pendentes = emp.parcelas.filter(p => p.status === 'pendente');
        if (pendentes.length === 0) emp.statusGeral = 'finalizado';

        const result = await window.db.pagarEmprestimo(currentLoanId, {
            valor: total,
            metodo: 'dinheiro',
            observacao: `Parcela #${numeroParcela} com multa: ${formatMoney(multaCalculada)}`,
            parcelas: emp.parcelas,
            statusGeral: emp.statusGeral,
            pagouComMulta: multaCalculada > 0,
            scoreEventos: [{ pagouComMulta: multaCalculada > 0 }],
        });
        if (!result?.success) {
            Object.assign(parcela, rollback.parcela);
            emp.statusGeral = rollback.statusGeral;
            if (state.caixa) state.caixa.saldo = rollback.caixaSaldo;
            showToast('Erro ao salvar pagamento no banco local.', 'error');
            return;
        }
        applyPaymentPersistenceResult(result);
        showToast(`Recebimento de ${formatMoney(total)} registrado!`);
        openPaymentModal(currentLoanId);
        updateUI();

    }
}

function applyPaymentPersistenceResult(result) {
    if (typeof syncCaixaFromPersistenceResult === 'function') syncCaixaFromPersistenceResult(result);

    if (result?.emprestimo?.id) {
        const idx = state.emprestimos.findIndex(e => e.id === result.emprestimo.id);
        if (idx !== -1) state.emprestimos[idx] = { ...state.emprestimos[idx], ...result.emprestimo };
    }

    if (result?.cliente?.id) {
        const idx = state.clientes.findIndex(c => c.id === result.cliente.id);
        const wasBlacklisted = idx !== -1 && state.clientes[idx]?.blacklist === true;
        if (typeof mergeClientePersistido === 'function') mergeClientePersistido(result.cliente);
        else if (idx !== -1) state.clientes[idx] = { ...state.clientes[idx], ...result.cliente };
        else state.clientes.push(result.cliente);

        if (!wasBlacklisted && result.cliente.blacklist === true && typeof showToast === 'function') {
            showToast(`${result.cliente.nome} foi enviado para a Lista de Bloqueados por score zerado.`, 'error');
        }
    }

    if (result?.transacao?.id && !state.transacoes.some(t => t.id === result.transacao.id)) {
        state.transacoes.push({
            ...result.transacao,
            contratoId: result.transacao.referenciaId || result.transacao.referencia_id || '',
            timestamp: Date.now(),
        });
    }
}

async function quitarTudo() {
    const emp = state.emprestimos.find(e => e.id === currentLoanId);
    const pendentes = emp.parcelas.filter(p => p.status === 'pendente');
    if (pendentes.length === 0) return;

    let totalPagar = 0;
    let resumo = "";
    const scoreEventos = [];
    pendentes.forEach(p => {
        const status = getStatus(p.vencimento, null, emp.carenciaDias);
        const multa = calcularMulta(p.valorBase, status.diasAtraso || 0, emp.multaDiaria, emp.multaFixa, emp.carenciaDias);
        totalPagar += (p.valorBase + multa);
        resumo += `Parc #${p.numero}: ${formatMoney(p.valorBase + multa)}\n`;
        scoreEventos.push({ pagouComMulta: multa > 0 });
    });

    if (confirm(`Deseja quitar TODAS as parcelas restantes?\n\n${resumo}\nTOTAL: ${formatMoney(totalPagar)}`)) {
        const rollback = {
            parcelas: pendentes.map(p => ({ ref: p, data: { ...p } })),
            statusGeral: emp.statusGeral,
            caixaSaldo: state.caixa?.saldo || 0,
        };
        pendentes.forEach(p => {
            const status = getStatus(p.vencimento, null, emp.carenciaDias);
            const multa = calcularMulta(p.valorBase, status.diasAtraso || 0, emp.multaDiaria, emp.multaFixa, emp.carenciaDias);
            p.status = 'pago';
            p.dataPagamento = new Date().toISOString().split('T')[0];
            p.valorPago = p.valorBase + multa;
            p.multaPaga = multa;
        });

        emp.statusGeral = 'finalizado';
        const result = await window.db.pagarEmprestimo(currentLoanId, {
            valor: totalPagar,
            metodo: 'dinheiro',
            observacao: `Quitação de ${pendentes.length} parcelas restantes`,
            parcelas: emp.parcelas,
            statusGeral: emp.statusGeral,
            pagouComMulta: scoreEventos.some(e => e.pagouComMulta),
            scoreEventos,
        });
        if (!result?.success) {
            rollback.parcelas.forEach(item => Object.assign(item.ref, item.data));
            emp.statusGeral = rollback.statusGeral;
            if (state.caixa) state.caixa.saldo = rollback.caixaSaldo;
            showToast('Erro ao salvar quitação no banco local.', 'error');
            return;
        }
        applyPaymentPersistenceResult(result);
        showToast("Empréstimo quitado com sucesso!");
        openPaymentModal(currentLoanId);
    }
}
