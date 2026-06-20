// SEÇÃO 11  MODAL DE EMPRÉSTIMO (Simulação & Criação)
// toggleParcelas()    ? alterna avulso/parcelado
// calcularSimulacao() ? calcula parcelas em tempo real
// openLoanModal()     ? configura e abre o modal
// checkLimitInfo()    ? verifica limite do cliente + saldo
// handleNewLoan()     ? cria o empréstimo no estado
var limitExceeded = false;
var _isResettingForm = false;

function _getTaxaPadraoParaTipo(tipoContrato) {
    const cfg = getLoanTemplateConfig();
    const tipo = normalizeContractType(tipoContrato);
    if (tipo === 'parcelado') return cfg.taxaParcelado;
    if (tipo === 'cartao') return cfg.taxaCartao;
    if (tipo === 'avulso') {
        const prazo = document.getElementById('emp-prazo-avulso')?.value || cfg.prazoAvulso;
        return prazo === '20' ? cfg.taxaAvulso20 : cfg.taxaAvulso30;
    }
    return cfg.taxaOutros;
}

function toggleParcelas() {
    if (_isResettingForm) return;
    const tipo = document.getElementById('emp-tipo').value;
    const divParcelas = document.getElementById('div-parcelas');
    const divAvulso = document.getElementById('div-avulso-opcoes');
    if (tipo === 'parcelado') {
        divParcelas.classList.remove('hidden');
        divAvulso.classList.add('hidden');
    } else {
        divParcelas.classList.add('hidden');
        divAvulso.classList.remove('hidden');
        aplicarPlanoAvulso();
    }
    const inputJuros = document.getElementById('emp-juros');
    if (inputJuros && tipo === 'parcelado') inputJuros.value = _getTaxaPadraoParaTipo(tipo);
    calcularSimulacao();
}

function aplicarPlanoAvulso() {
    if (_isResettingForm) return;
    const inputJuros = document.getElementById('emp-juros');
    const tipo = document.getElementById('emp-tipo')?.value || 'avulso';
    if (inputJuros) inputJuros.value = _getTaxaPadraoParaTipo(tipo);
    calcularSimulacao();
}

function calcularSimulacao() {
    if (_isResettingForm) return;
    const valor = parseFloat(document.getElementById('emp-valor').value) || 0;
    const juros = parseFloat(document.getElementById('emp-juros').value) || 0;
    const tipo = document.getElementById('emp-tipo').value;
    const qtd = parseInt(document.getElementById('emp-qtd-parcelas').value) || 1;
    const dataInicio = document.getElementById('emp-data').value;
    const totalComJuros = valor + (valor * (juros / 100));
    document.getElementById('sim-total').innerText = formatMoney(totalComJuros);
    let descDatas = "";
    let valorParcela = 0;
    if (tipo !== 'parcelado') {
        valorParcela = totalComJuros;
        const prazo = parseInt(document.getElementById('emp-prazo-avulso').value) || 30;
        const desc = tipo === 'cartao' ? 'Fatura única' : 'Pagamento único';
        document.getElementById('sim-desc-parcela').innerText = `${desc} (${prazo} dias)`;
        document.getElementById('sim-valor-parcela').innerText = formatMoney(valorParcela);
        if (dataInicio) {
            const venc = addDays(new Date(dataInicio), prazo);
            descDatas = `Vencimento: ${venc.toLocaleDateString('pt-BR')}`;
        }
    } else {
        valorParcela = totalComJuros / qtd;
        document.getElementById('sim-desc-parcela').innerText = `${qtd}x Parcelas de`;
        document.getElementById('sim-valor-parcela').innerText = formatMoney(valorParcela);
        if (dataInicio) {
            const start = new Date(dataInicio);
            const end = addMonths(start, qtd);
            descDatas = `1 parc: ${addMonths(start, 1).toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}`;
        }
    }
    document.getElementById('sim-datas').innerText = descDatas;
    checkLimitInfo();
}

// -- Cache de clientes ordenados para o modal de empréstimo --
let _sortedClientesCache = [];
let _sortedClientesCacheVersion = -1;
let _filtrarClientesTimer = null;
const _MAX_OPTIONS_MODAL = 100; // Limita options renderizados (performance)

function _getSortedClientes() {
    // Invalida cache se state mudou
    const version = state.clientes.length;
    if (_sortedClientesCacheVersion !== version) {
        _sortedClientesCache = [...state.clientes]
            .filter(c => (c.status || 'ativo') === 'ativo')
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        _sortedClientesCacheVersion = version;
    }
    return _sortedClientesCache;
}

function _populateSelectClientes(select, clientes) {
    const fragment = document.createDocumentFragment();
    const limited = clientes.slice(0, _MAX_OPTIONS_MODAL);
    for (let i = 0; i < limited.length; i++) {
        const opt = document.createElement('option');
        opt.value = limited[i].id;
        opt.textContent = limited[i].nome;
        fragment.appendChild(opt);
    }
    if (clientes.length > _MAX_OPTIONS_MODAL) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.textContent = `... e mais ${clientes.length - _MAX_OPTIONS_MODAL} (refine a busca)`;
        fragment.appendChild(opt);
    }
    select.innerHTML = '';
    select.appendChild(fragment);
}

function openLoanModal() {
    const select = document.getElementById('emp-cliente');
    const busca = document.getElementById('emp-cliente-busca');
    if (busca) busca.value = '';
    if (state.clientes.length === 0) {
        alert("Cadastre um cliente primeiro.");
        router('clientes');
        return;
    }
    const sorted = _getSortedClientes();
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    const fragment = document.createDocumentFragment();
    const limited = sorted.slice(0, _MAX_OPTIONS_MODAL);
    for (let i = 0; i < limited.length; i++) {
        const opt = document.createElement('option');
        opt.value = limited[i].id;
        opt.textContent = limited[i].nome;
        fragment.appendChild(opt);
    }
    if (sorted.length > _MAX_OPTIONS_MODAL) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.textContent = `... e mais ${sorted.length - _MAX_OPTIONS_MODAL} (use a busca acima)`;
        fragment.appendChild(opt);
    }
    select.appendChild(fragment);
    document.getElementById('emp-data').valueAsDate = new Date();
    document.getElementById('emp-valor').value = '';

    // Popula o <select> de tipo com os tipos configuráveis (base + extras).
    const selTipo = document.getElementById('emp-tipo');
    if (selTipo) {
        const tipos = (typeof getCreditTipos === 'function') ? getCreditTipos() : [
            { key: 'avulso', label: 'Avulso' }, { key: 'parcelado', label: 'Parcelado' }, { key: 'cartao', label: 'Cartão' }
        ];
        selTipo.innerHTML = tipos.map(t =>
            `<option value="${S(t.key)}">${S(t.label)}</option>`
        ).join('');
        selTipo.value = 'avulso';
    }
    const cfg = getLoanTemplateConfig();
    document.getElementById('emp-prazo-avulso').value = cfg.prazoAvulso;
    document.getElementById('emp-qtd-parcelas').value = String(cfg.qtdParcelas);
    document.getElementById('emp-multa-diaria').value = String(cfg.multaDiaria);
    const carenciaInput = document.getElementById('emp-carencia-dias');
    if (carenciaInput) carenciaInput.value = String(cfg.carenciaDias);
    const multaFixaInput = document.getElementById('emp-multa-fixa');
    if (multaFixaInput) multaFixaInput.value = String(cfg.multaFixa);
    document.getElementById('btn-override').classList.add('hidden');
    document.getElementById('div-override-input').classList.add('hidden');
    document.getElementById('auth-gestor').value = '';
    document.getElementById('btn-submit-emprestimo').disabled = false;
    document.getElementById('modal-score-display').classList.add('hidden');
    limitExceeded = false;
    const radioAprovado = document.querySelector('input[name="emp-aprovacao"][value="aprovado"]');
    if (radioAprovado) radioAprovado.checked = true;
    toggleParcelas();
    document.getElementById('aviso-limite').classList.add('hidden');
    document.getElementById('aviso-caixa').classList.add('hidden');
    document.getElementById('aviso-menor').classList.add('hidden');
    const chkMenor = document.getElementById('check-menor-confirm');
    if (chkMenor) chkMenor.checked = false;
    document.getElementById('modal-emprestimo').showModal();
}

function filtrarClientesModal(termo) {
    // Debounce de 150ms para evitar travamento ao digitar rápido
    if (_filtrarClientesTimer) clearTimeout(_filtrarClientesTimer);
    _filtrarClientesTimer = setTimeout(() => _executarFiltroModal(termo), 150);
}

function _executarFiltroModal(termo) {
    const select = document.getElementById('emp-cliente');
    const busca = (termo || '').toLowerCase().trim();
    const sorted = _getSortedClientes();
    const filtrados = busca
        ? sorted.filter(c => (c.nome || '').toLowerCase().includes(busca) || (c.cpf || '').includes(busca) || (c.telefone || '').includes(busca))
        : sorted;
    if (filtrados.length === 0) {
        select.innerHTML = '<option value="" disabled>Nenhum cliente encontrado</option>';
    } else {
        _populateSelectClientes(select, filtrados);
        // Auto-selecionar se restar apenas 1 resultado
        if (filtrados.length === 1) {
            select.value = filtrados[0].id;
            checkLimitInfo();
        }
    }
}

// Funo leve  só reavalia bloqueio de caixa quando muda o status de aprovação (sem recalcular score/risk)
function onAprovacaoChange() {
    if (_isResettingForm) return;
    const avisoCaixa = document.getElementById('aviso-caixa');
    const btnSubmit = document.getElementById('btn-submit-emprestimo');
    const valorSimulado = parseFloat(document.getElementById('emp-valor').value) || 0;
    const aprovacaoSelecionada = document.querySelector('input[name="emp-aprovacao"]:checked')?.value || 'aprovado';

    if (aprovacaoSelecionada === 'aprovado' && valorSimulado > state.caixa.saldo) {
        avisoCaixa.classList.remove('hidden');
        btnSubmit.disabled = true;
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        avisoCaixa.classList.add('hidden');
        // Só reabilita se não houver outro bloqueio (limite excedido sem auth)
        if (limitExceeded) {
            const gestorAuth = document.getElementById('auth-gestor').value.trim();
            btnSubmit.disabled = gestorAuth.length === 0;
        } else {
            btnSubmit.disabled = false;
        }
        btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function checkLimitInfo() {
    if (_isResettingForm) return;
    const clienteId = document.getElementById('emp-cliente').value;
    const tipoContrato = normalizeContractType(document.getElementById('emp-tipo').value);
    const avisoDiv = document.getElementById('aviso-limite');
    const avisoCaixa = document.getElementById('aviso-caixa');
    const valSpan = document.getElementById('val-disponivel');
    const btnOverride = document.getElementById('btn-override');
    const btnSubmit = document.getElementById('btn-submit-emprestimo');
    const scoreDisplay = document.getElementById('modal-score-display');
    const gestorAuth = document.getElementById('auth-gestor').value.trim();
    const valorSimulado = parseFloat(document.getElementById('emp-valor').value) || 0;

    // Status de aprovação selecionado  contratos em análise/reprovado não precisam de saldo
    const aprovacaoSelecionada = document.querySelector('input[name="emp-aprovacao"]:checked')?.value || 'aprovado';

    // 1. Check de Caixa  só bloqueia se contrato for APROVADO
    if (aprovacaoSelecionada === 'aprovado' && valorSimulado > state.caixa.saldo) {
        avisoCaixa.classList.remove('hidden');
        btnSubmit.disabled = true;
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
        return; // Bloqueia tudo
    } else {
        avisoCaixa.classList.add('hidden');
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    if (!clienteId) {
        avisoDiv.classList.add('hidden');
        scoreDisplay.classList.add('hidden');
        document.getElementById('aviso-menor').classList.add('hidden');
        return;
    }

    // Check de menor de idade (não-blocante  mostra aviso visual)
    const clienteObj = state.clientes.find(c => c.id === clienteId);
    const avisoMenor = document.getElementById('aviso-menor');
    if (clienteObj) {
        const age = calculateAge(clienteObj.dataNascimento);
        if (age < 18) {
            document.getElementById('aviso-menor-idade').textContent = age;
            avisoMenor.classList.remove('hidden');
        } else {
            avisoMenor.classList.add('hidden');
            const chk = document.getElementById('check-menor-confirm');
            if (chk) chk.checked = false;
        }
    }

    const score = Math.round(analyzeRisk(clienteId).score);
    scoreDisplay.innerHTML = `Score Atual do Cliente: <b>${score}</b>`;
    scoreDisplay.classList.remove('hidden');
    if (score < 400) scoreDisplay.className = "text-xs mt-1 text-red-600 font-bold";
    else if (score >= 800) scoreDisplay.className = "text-xs mt-1 text-emerald-600 font-bold";
    else scoreDisplay.className = "text-xs mt-1 text-blue-600 font-bold";

    const cliente = state.clientes.find(c => c.id === clienteId);
    const emUso = getClientUsedCredit(clienteId, tipoContrato);
    const limiteTipo = getClientLimitByType(clienteId, tipoContrato);
    const disponivel = limiteTipo - emUso;
    const tipoLimite = cliente.tipoLimite || 'total';
    const juros = parseFloat(document.getElementById('emp-juros').value) || 0;
    const _tiposChk = (typeof getCreditTipos === 'function') ? getCreditTipos() : [];
    const _tipoCfgChk = _tiposChk.find(t => t.key === tipoContrato);
    const labelTipoContrato = _tipoCfgChk ? _tipoCfgChk.label : tipoContrato;

    let debitoSimulado = 0;
    if (tipoLimite === 'principal') {
        debitoSimulado = valorSimulado;
    } else {
        debitoSimulado = valorSimulado + (valorSimulado * (juros / 100));
    }

    avisoDiv.classList.remove('hidden');
    const textoTipo = tipoLimite === 'principal' ? '(S/ Juros)' : '(C/ Juros)';
    if (debitoSimulado > disponivel) {
        limitExceeded = true;
        // Aviso já  vermelho por padrão, apenas atualiza texto
        valSpan.innerText = `${formatMoney(disponivel)} ${textoTipo} [${labelTipoContrato}] - INSUFICIENTE`;
        btnOverride.classList.remove('hidden');
        if (gestorAuth.length > 0) btnSubmit.disabled = false;
        else btnSubmit.disabled = true;
    } else {
        limitExceeded = false;
        // Esconde aviso se ok
        avisoDiv.classList.add('hidden');
        btnOverride.classList.add('hidden');
        document.getElementById('div-override-input').classList.add('hidden');
        document.getElementById('auth-gestor').value = '';
        btnSubmit.disabled = false;
    }
}

function showOverrideInput() {
    document.getElementById('div-override-input').classList.remove('hidden');
    document.getElementById('auth-gestor').focus();
}

function checkOverrideAuth() {
    checkLimitInfo();
}

async function handleNewLoan(e) {
    e.preventDefault();

    // Prevenir double submit
    const btnSubmit = document.getElementById('btn-submit-emprestimo');
    if (btnSubmit.dataset.submitting === 'true') return;
    btnSubmit.dataset.submitting = 'true';

    const clienteId = document.getElementById('emp-cliente').value;
    const valorOriginal = parseFloat(document.getElementById('emp-valor').value);
    const taxaJuros = parseFloat(document.getElementById('emp-juros').value);
    const tipo = document.getElementById('emp-tipo').value;
    const qtdParcelas = tipo === 'parcelado' ? parseInt(document.getElementById('emp-qtd-parcelas').value) : 1;
    const dataInicio = document.getElementById('emp-data').value;
    const multaDiaria = Math.max(0, parseFloat(document.getElementById('emp-multa-diaria').value) || 0);
    const carenciaDias = Math.max(0, parseInt(document.getElementById('emp-carencia-dias')?.value || '0', 10) || 0);
    const multaFixa = Math.max(0, parseFloat(document.getElementById('emp-multa-fixa')?.value || '0') || 0);
    const gestorAuth = document.getElementById('auth-gestor').value.trim();
    checkLimitInfo();

    // VALIDAÇÃO DE BLACKLIST (não-blocante  showToast em vez de alert)
    const clienteBlacklist = state.clientes.find(c => c.id === clienteId);
    if (clienteBlacklist && clienteBlacklist.blacklist) {
        showToast('? BLOQUEADO: Cliente na Blacklist!');
        btnSubmit.dataset.submitting = 'false';
        return;
    }

    // Obter status de aprovação selecionado
    const aprovacaoSelecionada = document.querySelector('input[name="emp-aprovacao"]:checked')?.value || 'aprovado';

    // VALIDAÇÃO DE CAIXA  só bloqueia se for contrato aprovado
    if (aprovacaoSelecionada === 'aprovado' && state.caixa.saldo < valorOriginal) {
        showToast('Saldo em caixa insuficiente!');
        btnSubmit.dataset.submitting = 'false';
        return;
    }

    // Compliance menor de idade  verificação não-blocante via checkbox
    const age = calculateAge(state.clientes.find(c => c.id === clienteId).dataNascimento);
    if (age < 18) {
        const checkMenor = document.getElementById('check-menor-confirm');
        if (!checkMenor || !checkMenor.checked) {
            showToast('Marque a confirmação de ciência para menor de idade!');
            btnSubmit.dataset.submitting = 'false';
            return;
        }
    }

    const valorTotal = valorOriginal + (valorOriginal * (taxaJuros / 100));
    const valorParcela = valorTotal / qtdParcelas;

    if (limitExceeded && !gestorAuth) {
        showToast('Limite excedido. Autorização do gestor necessória!');
        btnSubmit.dataset.submitting = 'false';
        return;
    }

    let parcelas = [];
    let dataBase = new Date(dataInicio);
    dataBase.setHours(12, 0, 0, 0);

    for (let i = 1; i <= qtdParcelas; i++) {
        let vencimento;
        if (tipo !== 'parcelado') {
            const prazoAvulso = parseInt(document.getElementById('emp-prazo-avulso').value) || 30;
            vencimento = new Date(dataBase);
            vencimento.setDate(vencimento.getDate() + prazoAvulso);
        } else {
            vencimento = new Date(dataBase);
            vencimento.setMonth(vencimento.getMonth() + i);
        }

        parcelas.push({
            numero: i,
            valorBase: valorParcela,
            vencimento: vencimento.toISOString().split('T')[0],
            status: 'pendente',
            dataPagamento: null,
            valorPago: 0,
            multaPaga: 0
        });
    }

    const novoEmp = {
        id: String(Date.now()),
        clienteId,
        valorOriginal,
        taxaJuros,
        valorTotal,
        tipo,
        dataInicio,
        multaDiaria,
        multaFixa,
        carenciaDias,
        parcelas,
        statusGeral: 'ativo',
        aprovacao: aprovacaoSelecionada,
        liberadoPor: limitExceeded ? gestorAuth : null,
        gestorResponsavel: getGestorName()
    };

    state.emprestimos.push(novoEmp);
    const empResult = await persistEmprestimo(novoEmp);
    if (!empResult?.success) {
        const idx = state.emprestimos.findIndex(e => e.id === novoEmp.id);
        if (idx !== -1) state.emprestimos.splice(idx, 1);
        showToast('Erro ao salvar contrato. Verifique o banco local.', 'error');
        btnSubmit.dataset.submitting = 'false';
        return;
    }
    if (novoEmp.aprovacao === 'aprovado') {
        showToast('Contrato APROVADO e valor descontado do caixa!');
    } else {
        const statusLabel = novoEmp.aprovacao === 'em_analise' ? 'EM ANÁLISE' : 'REPROVADO';
        showToast(`Contrato salvo como ${statusLabel}. Nenhum valor debitado do caixa.`);
    }

    // Fechar modal PRIMEIRO (antes do reset para não travar a UI)
    document.getElementById('modal-emprestimo').close();

    // Flag global bloqueia calcularSimulacao/checkLimitInfo durante o reset
    _isResettingForm = true;
    e.target.reset();
    _isResettingForm = false;
    btnSubmit.dataset.submitting = 'false';

    // Adiar atualização pesada para o próximo frame (libera a UI instantaneamente)
    requestAnimationFrame(() => {
        invalidateRiskCache();
        updateHeaderSaldo();
        const activeNav = document.querySelector('.sidebar-nav-item.nav-active');
        if (activeNav) {
            const page = activeNav.id.replace('nav-', '');
            if (['em_aberto', 'aprovados', 'em_analise', 'reprovados', 'inadimplentes', 'finalizados'].includes(page)) {
                renderFilteredLoans(document.getElementById('app-content'), page);
                refreshIcons();
            }
            if (page === 'dashboard') {
                const dashCaixa = document.getElementById('dash-caixa');
                if (dashCaixa) dashCaixa.textContent = formatMoney(state.caixa.saldo);
            }
        }
    });
}
