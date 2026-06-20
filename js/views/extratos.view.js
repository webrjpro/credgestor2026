// SEÇÃO 16  VIEW EXTRATOS (Histórico + PDF + ZIP)
// renderExtratos()     ? tabela de todas as transações (paginado)
// gerarComprovantePDF() ? PDF estilo bancário (jsPDF)
// baixarComprovante()  ? baixa PDF de uma transação
// baixarFechamentoDia() ? ZIP com PDFs do dia
// baixarHistoricoCompletoZip() ? ZIP com todo o histórico
let _extratosPagina = 0;
const _EXTRATOS_POR_PAGINA = 50;

function getTransacaoOperacaoLabel(transacao) {
    if (transacao?.operacao) return transacao.operacao;
    const descricao = String(transacao?.descricao || '').trim();
    if (descricao.includes(' - ')) return descricao.split(' - ')[0].trim();
    if (descricao.includes(':')) return descricao.split(':')[0].trim();
    if (transacao?.tipo === 'saida') return 'Saída';
    if (transacao?.tipo === 'entrada') return 'Entrada';
    return transacao?.tipo || 'Transação';
}

function getTransacaoDetalheLabel(transacao) {
    if (transacao?.detalhe) return transacao.detalhe;
    const descricao = String(transacao?.descricao || '').trim();
    if (descricao.includes(' - ')) return descricao.split(' - ').slice(1).join(' - ').trim();
    if (descricao.includes(':')) return descricao.split(':').slice(1).join(':').trim();
    return descricao;
}

function renderExtratos(container) {
    _extratosPagina = 0;
    _renderExtratosPage(container);
}

function _renderExtratosPage(container) {
    const historico = state.transacoes.slice().reverse();
    const totalRecebido = historico.reduce((acc, t) => acc + t.valor, 0);
    const inicio = _extratosPagina * _EXTRATOS_POR_PAGINA;
    const pagina = historico.slice(inicio, inicio + _EXTRATOS_POR_PAGINA);
    const totalPaginas = Math.ceil(historico.length / _EXTRATOS_POR_PAGINA) || 1;
    const paginaAtual = _extratosPagina + 1;

    container.innerHTML = `
         <div class="space-y-6 fade-in">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">Histórico de Transações <span class="text-sm font-normal text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full ml-2">${historico.length}</span></h3>
                <div class="flex gap-2 w-full md:w-auto">
                     <button onclick="baixarHistoricoCompletoZip()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all whitespace-nowrap text-sm font-bold">
                        <i data-lucide="archive"></i> Baixar TUDO (ZIP)
                    </button>
                    <div class="bg-white dark:bg-slate-800 px-5 py-2 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3">
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Total Recebido</span>
                        <p class="text-xl font-black text-emerald-600">${formatMoney(totalRecebido)}</p>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-600">
                        <tr>
                            <th class="px-6 py-4">Data/Hora</th>
                            <th class="px-6 py-4">Cliente</th>
                            <th class="px-6 py-4">Detalhe</th>
                            <th class="px-6 py-4">Valor</th>
                            <th class="px-6 py-4">Auth Code</th>
                            <th class="px-6 py-4 text-right">Comprovante</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50 dark:divide-slate-700">
                        ${pagina.map(t => `
                            <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                                <td class="px-6 py-4 text-slate-500 dark:text-slate-400">
                                    <div class="flex flex-col">
                                        <span class="font-bold text-slate-700 dark:text-slate-300">${new Date(t.data).toLocaleDateString()}</span>
                                        <span class="text-xs">${new Date(t.data).toLocaleTimeString()}</span>
                                    </div>
                                </td>
                                <td class="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">${S(t.clienteNome)}</td>
                                <td class="px-6 py-4">
                                    <span class="block text-slate-700 dark:text-slate-300 font-medium">${S(getTransacaoOperacaoLabel(t))}</span>
                                    <span class="text-xs text-slate-400">${S(getTransacaoDetalheLabel(t))}</span>
                                </td>
                                <td class="px-6 py-4 text-emerald-600 font-black tracking-tight">${formatMoney(t.valor)}</td>
                                <td class="px-2 py-1 text-[10px] font-mono text-slate-400 select-all bg-slate-50 dark:bg-slate-700 rounded w-fit">${t.id.substring(0, 12)}...</td>
                                <td class="px-6 py-4 text-right">
                                    <button onclick="baixarComprovante('${t.id}')" class="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-all flex items-center justify-end gap-1 w-full font-bold text-xs">
                                        <i data-lucide="file-check" class="w-4 h-4"></i> PDF
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${historico.length === 0 ? `<div class="p-12 text-center text-slate-400 flex flex-col items-center">
                    <i data-lucide="ghost" class="w-8 h-8 text-slate-300 mb-2"></i>
                    Nenhuma transação registrada.
                </div>` : ''}
            </div>

            ${totalPaginas > 1 ? `
            <div class="flex items-center justify-center gap-3 mt-4">
                <button onclick="_extratosPagina--;_renderExtratosPage(document.getElementById('app-content'))" 
                    class="px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${_extratosPagina > 0 ? 'border-brand-200 text-brand-600 hover:bg-brand-50 cursor-pointer' : 'border-slate-200 text-slate-300 cursor-not-allowed'}"
                    ${_extratosPagina === 0 ? 'disabled' : ''}>
                    ? Anterior
                </button>
                <span class="text-sm font-medium text-slate-500">Página ${paginaAtual} de ${totalPaginas}</span>
                <button onclick="_extratosPagina++;_renderExtratosPage(document.getElementById('app-content'))"
                    class="px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${paginaAtual < totalPaginas ? 'border-brand-200 text-brand-600 hover:bg-brand-50 cursor-pointer' : 'border-slate-200 text-slate-300 cursor-not-allowed'}"
                    ${paginaAtual >= totalPaginas ? 'disabled' : ''}>
                    Próxima ?
                </button>
            </div>` : ''}
        </div>
    `;
    refreshIcons();
}

// -- Geração de PDF (Comprovante estilo bancário  jsPDF) --
function gerarComprovantePDF(transacao) {
    const { jsPDF } = window.jspdf;
    // Identidade configurável
    const nomeEmpresa = state.config.empresaNome || "CredGestor";
    const printCfg = getPrintConfig();

    if (printCfg.thermal) {
        const W = printCfg.widthMm;
        const doc = new jsPDF({ unit: 'mm', format: [W, 150] });
        const pad = W <= 58 ? 3 : 4;
        let y = 7;

        doc.setFont('helvetica', 'bold').setFontSize(W <= 58 ? 9 : 10);
        doc.text(nomeEmpresa.slice(0, 34), W / 2, y, { align: 'center' });
        y += 5;
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text('COMPROVANTE DE TRANSACAO', W / 2, y, { align: 'center' });
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

        row('Beneficiario', nomeEmpresa);
        row('Pagador', transacao.clienteNome);
        row('Data', new Date(transacao.data).toLocaleString('pt-BR'));
        row('Operacao', getTransacaoOperacaoLabel(transacao));
        row('Descricao', getTransacaoDetalheLabel(transacao));
        row('Valor total', formatMoney(transacao.valor), true);
        doc.line(pad, y, W - pad, y);
        y += 5;
        doc.setFont('courier', 'normal').setFontSize(6.5);
        doc.text(doc.splitTextToSize(`Autenticacao: ${transacao.id}`, W - pad * 2), pad, y);
        return doc;
    }

    const doc = new jsPDF();

    doc.setFont("helvetica");
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(nomeEmpresa, 10, 13);
    doc.setFontSize(10);
    doc.text("Comprovante de Transação", 190, 13, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("Comprovante de Pagamento", 105, 40, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);
    let y = 60;
    const lineHeight = 10;
    doc.setFontSize(10);
    doc.setTextColor(100); doc.text("BENEFICIÁRIO", 20, y); doc.setTextColor(0); doc.text(nomeEmpresa, 190, y, { align: "right" }); y += lineHeight;
    doc.setTextColor(100); doc.text("PAGADOR", 20, y); doc.setTextColor(0); doc.text(transacao.clienteNome, 190, y, { align: "right" }); y += lineHeight;
    doc.setTextColor(100); doc.text("DATA DO PAGAMENTO", 20, y); doc.setTextColor(0); doc.text(new Date(transacao.data).toLocaleString('pt-BR'), 190, y, { align: "right" }); y += lineHeight;
    doc.setTextColor(100); doc.text("TIPO DE OPERAÇÃO", 20, y); doc.setTextColor(0); doc.text(getTransacaoOperacaoLabel(transacao), 190, y, { align: "right" }); y += lineHeight;
    doc.setTextColor(100); doc.text("DESCRIÇÃO", 20, y); doc.setTextColor(0); doc.text(getTransacaoDetalheLabel(transacao), 190, y, { align: "right" }); y += lineHeight + 5;
    doc.setFillColor(243, 244, 246); doc.rect(20, y - 5, 170, 15, 'F');
    doc.setFontSize(12); doc.text("VALOR TOTAL", 25, y + 5);
    doc.setFontSize(14); doc.setTextColor(16, 185, 129); doc.text(formatMoney(transacao.valor), 185, y + 5, { align: "right" }); y += 30;
    doc.setFontSize(9); doc.setTextColor(150); doc.text("Autenticação Mecânica:", 105, y, { align: "center" });
    doc.setFont("courier"); doc.setTextColor(0); doc.text(transacao.id, 105, y + 5, { align: "center" });
    return doc;
}

function baixarComprovante(id) {
    const transacao = state.transacoes.find(t => t.id === id);
    if (!transacao) return;
    const doc = gerarComprovantePDF(transacao);
    const fileName = `Comprovante_${transacao.clienteNome.split(' ')[0]}_${transacao.id.slice(0, 6)}.pdf`;
    doc.save(fileName);
}

// -- Fechamento do Dia (ZIP com PDFs  JSZip + FileSaver) --
function baixarFechamentoDia() {
    const hoje = new Date().toISOString().split('T')[0];
    const transacoesHoje = state.transacoes.filter(t => t.data.startsWith(hoje));

    if (transacoesHoje.length === 0) {
        alert("Nenhuma transação registrada hoje para gerar fechamento.");
        return;
    }

    const zip = new JSZip();
    const pasta = zip.folder(`Fechamento_${hoje}`);
    let totalDia = 0;

    transacoesHoje.forEach(t => {
        totalDia += t.valor;
        const doc = gerarComprovantePDF(t);
        const pdfBlob = doc.output('blob');
        const hora = new Date(t.data).getHours() + 'h' + new Date(t.data).getMinutes();
        const nomeArquivo = `${t.clienteNome.replace(/\s+/g, '_')}_${t.valor.toFixed(2)}_${hora}.pdf`;
        pasta.file(nomeArquivo, pdfBlob);
    });

    const resumo = `FECHAMENTO DE CAIXA - ${hoje}\n` +
        `--------------------------------\n` +
        `Total de Transações: ${transacoesHoje.length}\n` +
        `Volume Total: ${formatMoney(totalDia)}\n` +
        `Gerado em: ${new Date().toLocaleString()}\n`;
    pasta.file("Resumo_do_Dia.txt", resumo);

    zip.generateAsync({ type: "blob" })
        .then(function (content) {
            saveAs(content, `Fechamento_Caixa_${hoje}.zip`);
            showToast("Fechamento (ZIP) baixado com sucesso!");
        });
}

// -- Baixar Tudo (ZIP com histórico completo) --
function baixarHistoricoCompletoZip() {
    const todasTransacoes = state.transacoes;
    if (todasTransacoes.length === 0) {
        alert("Nenhuma transação registrada no histórico.");
        return;
    }
    if (!confirm(`Deseja baixar ${todasTransacoes.length} comprovantes em um arquivo ZIP? Isso pode levar alguns segundos.`)) return;

    const zip = new JSZip();
    const pasta = zip.folder(`Historico_Completo`);
    let totalGeral = 0;

    todasTransacoes.sort((a, b) => new Date(a.data) - new Date(b.data));

    todasTransacoes.forEach(t => {
        totalGeral += t.valor;
        const doc = gerarComprovantePDF(t);
        const pdfBlob = doc.output('blob');
        const dataStr = t.data.split('T')[0];
        const nomeArquivo = `${dataStr}_${t.clienteNome.replace(/[^a-zA-Z0-9]/g, '_')}_${t.valor.toFixed(2)}.pdf`;
        pasta.file(nomeArquivo, pdfBlob);
    });

    const resumo = `HISTÓRICO COMPLETO DE TRANSAES\n` +
        `--------------------------------\n` +
        `Total de Transações: ${todasTransacoes.length}\n` +
        `Volume Total Acumulado: ${formatMoney(totalGeral)}\n` +
        `Gerado em: ${new Date().toLocaleString()}\n`;
    pasta.file("Resumo_Geral.txt", resumo);

    showToast("Gerando ZIP completo... Aguarde.");
    zip.generateAsync({ type: "blob" }).then(function (content) {
        saveAs(content, `Historico_Completo_CredGestor.zip`);
        showToast("ZIP Completo baixado com sucesso!");
    });
}

// -- CRUD de Clientes (criar/editar/excluir) --
const DEFAULT_PERCENTUAL_LIMITE_RENDA = 1 / 3;

function _formatPercentInputValue(fraction) {
    const pct = (Number(fraction) || 0) * 100;
    return pct.toFixed(4).replace(/\.?0+$/, '');
}

function atualizarLimitePorRenda() {
    const rendaInput = document.getElementById('cliente-renda');
    const percentualInput = document.getElementById('cliente-percentual-renda');
    const limiteInput = document.getElementById('cliente-limite');
    if (!rendaInput || !percentualInput || !limiteInput) return;

    const renda = parseFloat(rendaInput.value);
    const percentual = parseFloat(percentualInput.value);
    if (!Number.isFinite(renda) || !Number.isFinite(percentual) || renda < 0 || percentual < 0) return;

    const limiteCalculado = renda * (percentual / 100);
    if (!Number.isFinite(limiteCalculado)) return;
    limiteInput.value = limiteCalculado.toFixed(2);
}

function openNewClienteModal() {
    editingCustomerId = null;
    document.getElementById('form-cliente').reset();
    const novaMatricula = ensureUniqueMatriculaLocal('', collectUsedMatriculas());
    document.getElementById('cliente-matricula').value = novaMatricula.matricula;
    document.getElementById('cliente-percentual-renda').value = _formatPercentInputValue(DEFAULT_PERCENTUAL_LIMITE_RENDA);
    _renderClienteLimitesInputs(null);
    document.getElementById('modal-cliente-title').innerText = 'Cadastro de Cliente';
    document.getElementById('btn-salvar-cliente').innerText = 'Salvar Cadastro';
    openModal('modal-cliente');
}

async function abrirResetSenhaPortal() {
    showToast('Portal removido no modo offline.', 'warning');
}

// Renderiza os inputs de "Limites por Tipo de Crédito" dinamicamente conforme
// os tipos configurados em Configurações → Tipos de Crédito. O tipo "avulso"
// já é atendido pelo campo "Limite Aprovado" e é pulado.
function _renderClienteLimitesInputs(cliente) {
    const box = document.getElementById('cliente-limites-por-tipo');
    if (!box) return;
    const tipos = (typeof getCreditTipos === 'function') ? getCreditTipos() : [];
    const extrasSalvos = (cliente && cliente.limitesTipos && typeof cliente.limitesTipos === 'object') ? cliente.limitesTipos : {};
    const html = tipos
        .filter(t => t.key !== 'avulso') // avulso usa cliente-limite (base)
        .map(t => {
            let valor = '';
            if (t.key === 'parcelado' && cliente) {
                const lp = cliente.limiteParcelado ?? cliente.limite_parcelado;
                if (Number.isFinite(Number(lp))) valor = String(Number(lp));
            } else if (t.key === 'cartao' && cliente) {
                const lc = cliente.limiteCartao ?? cliente.limite_cartao;
                if (Number.isFinite(Number(lc))) valor = String(Number(lc));
            } else if (t.isExtra && cliente) {
                const v = extrasSalvos[t.key];
                if (Number.isFinite(Number(v))) valor = String(Number(v));
            }
            const placeholder = t.isExtra ? 'Opcional (usa limite aprovado)' : 'Opcional (usa limite aprovado)';
            return `
                <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1.5">
                        Limite ${S(t.label)} (R$)
                        ${t.isExtra ? '<span class="ml-1 text-[9px] font-bold text-purple-600">EXTRA</span>' : ''}
                    </label>
                    <div class="relative">
                        <span class="absolute left-3 top-3 text-slate-400 text-sm">R$</span>
                        <input type="number" data-tipo-key="${S(t.key)}" step="0.01" min="0"
                            value="${S(valor)}"
                            class="cliente-limite-tipo-input w-full input-premium rounded-xl pl-9 p-3 text-sm text-slate-800"
                            placeholder="${S(placeholder)}">
                    </div>
                </div>`;
        })
        .join('');
    box.innerHTML = html || '<p class="text-xs text-slate-400 italic">Nenhum tipo extra configurado. Apenas o "Limite Aprovado" acima será usado.</p>';
}

function openEditClienteModal(id) {
    const cliente = state.clientes.find(c => c.id === id);
    if (!cliente) return;

    editingCustomerId = id;
    document.getElementById('cliente-nome').value = cliente.nome;
    document.getElementById('cliente-matricula').value = cliente.matricula || '';
    document.getElementById('cliente-cpf').value = cliente.cpf;
    document.getElementById('cliente-nasc').value = cliente.dataNascimento || '';
    document.getElementById('cliente-tel').value = cliente.telefone;
    document.getElementById('cliente-email').value = cliente.email;
    document.getElementById('cliente-renda').value = cliente.renda ?? 0;
    document.getElementById('cliente-percentual-renda').value = _formatPercentInputValue(cliente.percentualLimiteRenda ?? DEFAULT_PERCENTUAL_LIMITE_RENDA);
    document.getElementById('cliente-limite').value = cliente.limite;
    _renderClienteLimitesInputs(cliente);
    // Mantem os inputs hidden sincronizados para rotinas que leem por ID.
    document.getElementById('cliente-limite-parcelado').value = cliente.limiteParcelado ?? cliente.limite;
    document.getElementById('cliente-limite-cartao').value = cliente.limiteCartao ?? cliente.limite;
    document.getElementById('cliente-tipo-limite').value = cliente.tipoLimite || 'total';
    document.getElementById('cliente-dia-venc').value = cliente.diaVencimento;
    document.getElementById('cliente-obs').value = cliente.obs;
    document.getElementById('cliente-tipo-pag').value = cliente.tipoPagamento || '';
    // Banco: verificar se o valor salvo corresponde a uma opção do select
    const bancoSelect = document.getElementById('cliente-banco');
    const bancoSalvo = cliente.banco || '';
    const opcaoExiste = Array.from(bancoSelect.options).some(o => o.value === bancoSalvo);
    if (opcaoExiste) {
        bancoSelect.value = bancoSalvo;
        document.getElementById('cliente-banco-outro').value = '';
    } else if (bancoSalvo) {
        bancoSelect.value = 'outro';
        document.getElementById('cliente-banco-outro').value = bancoSalvo;
    } else {
        bancoSelect.value = '';
        document.getElementById('cliente-banco-outro').value = '';
    }
    document.getElementById('cliente-agencia').value = cliente.agencia || '';
    document.getElementById('cliente-operacao').value = cliente.operacao || '';
    document.getElementById('cliente-conta').value = cliente.conta || '';
    document.getElementById('cliente-chave-pix').value = cliente.chavePix || '';
    toggleTransferenciaFields();
    toggleBancoOutro();

    document.getElementById('modal-cliente-title').innerText = 'Editar Cliente';
    document.getElementById('btn-salvar-cliente').innerText = 'Atualizar Cliente';

    openModal('modal-cliente');
}

async function handleNewCustomer(e) {
    e.preventDefault();
    const nome = document.getElementById('cliente-nome').value;
    const matriculaInput = document.getElementById('cliente-matricula').value;
    const cpf = document.getElementById('cliente-cpf').value;
    const nasc = document.getElementById('cliente-nasc').value;
    const tel = document.getElementById('cliente-tel').value;
    const email = document.getElementById('cliente-email').value;
    const renda = Math.max(0, parseFloat(document.getElementById('cliente-renda').value) || 0);
    const percentualLimiteRenda = Math.max(0, (parseFloat(document.getElementById('cliente-percentual-renda').value) || 0) / 100);
    const limite = parseFloat(document.getElementById('cliente-limite').value) || 0;
    // Lê os inputs dinâmicos de "Limites por Tipo". Cada input tem data-tipo-key.
    const dynInputs = Array.from(document.querySelectorAll('.cliente-limite-tipo-input'));
    const valoresPorTipo = {};
    for (const inp of dynInputs) {
        const key = String(inp.dataset.tipoKey || '').trim().toLowerCase();
        if (!key) continue;
        const raw = parseFloat(inp.value);
        if (Number.isFinite(raw)) valoresPorTipo[key] = Math.max(0, raw);
    }
    // Compatibilidade: parcelado/cartao continuam em colunas dedicadas (fallback p/ input hidden).
    const limiteParcelado = Number.isFinite(valoresPorTipo.parcelado)
        ? valoresPorTipo.parcelado
        : (Number.isFinite(parseFloat(document.getElementById('cliente-limite-parcelado').value)) ? parseFloat(document.getElementById('cliente-limite-parcelado').value) : limite);
    const limiteCartao = Number.isFinite(valoresPorTipo.cartao)
        ? valoresPorTipo.cartao
        : (Number.isFinite(parseFloat(document.getElementById('cliente-limite-cartao').value)) ? parseFloat(document.getElementById('cliente-limite-cartao').value) : limite);
    // Extras (JSON): tudo que não seja avulso/parcelado/cartao.
    const limitesTipos = {};
    for (const [k, v] of Object.entries(valoresPorTipo)) {
        if (k === 'avulso' || k === 'parcelado' || k === 'cartao') continue;
        limitesTipos[k] = v;
    }
    const tipoLimite = document.getElementById('cliente-tipo-limite').value;
    const diaVenc = document.getElementById('cliente-dia-venc').value;
    const obs = document.getElementById('cliente-obs').value;
    const tipoPagamento = document.getElementById('cliente-tipo-pag').value;
    const bancoSel = document.getElementById('cliente-banco').value;
    const banco = bancoSel === 'outro' ? document.getElementById('cliente-banco-outro').value : bancoSel;
    const agencia = document.getElementById('cliente-agencia').value;
    const operacao = document.getElementById('cliente-operacao').value;
    const conta = document.getElementById('cliente-conta').value;
    const chavePix = document.getElementById('cliente-chave-pix').value;
    const matriculasUsadas = collectUsedMatriculas(editingCustomerId || '');
    const matriculaResult = ensureUniqueMatriculaLocal(matriculaInput, matriculasUsadas);
    if (!matriculaResult.ok) {
        showToast('Matrícula já cadastrada para outro cliente.');
        return;
    }

    let matricula = matriculaResult.matricula;
    if (window.db?.checkMatricula) {
        const isManualMatricula = !!normalizeMatriculaLocal(matriculaInput || '');
        let matriculaDisponivel = false;
        for (let tentativas = 0; tentativas < 20; tentativas++) {
            const check = await window.db.checkMatricula(matricula, editingCustomerId || '');
            if (!check || check.success !== true) {
                showToast('Falha ao validar matrícula no banco local.', 'error');
                return;
            }
            if (!check.exists) {
                matriculaDisponivel = true;
                break;
            }

            if (isManualMatricula) {
                showToast('Matrícula já cadastrada no banco.', 'error');
                return;
            }
            matricula = generateMatriculaLocal();
        }

        if (!matriculaDisponivel) {
            showToast('Não foi possível gerar uma matrícula nica. Tente novamente.', 'error');
            return;
        }
    }

    // Validação de Idade (AI Module)
    const age = calculateAge(nasc);
    if (nasc && age < 18) {
        if (!confirm(`ALERTA: Cliente menor de idade (${age} anos). Continuar?`)) return;
    }

    if (editingCustomerId) {
        const index = state.clientes.findIndex(c => c.id === editingCustomerId);
        if (index === -1) {
            showToast('Cliente não encontrado para atualização.', 'error');
            return;
        }

        const clienteAtualizado = {
            ...state.clientes[index],
            nome, matricula, cpf, dataNascimento: nasc, telefone: tel, email,
            renda, percentualLimiteRenda, limite, limiteParcelado, limiteCartao,
            limitesTipos,
            tipoLimite, diaVencimento: diaVenc, obs,
            tipoPagamento, banco, agencia, operacao, conta, chavePix
        };
        const persistResult = await persistCliente(clienteAtualizado);
        if (!persistResult || persistResult.success !== true) {
            showToast(`Falha ao atualizar cliente: ${persistResult?.error || 'erro desconhecido'}`, 'error');
            return;
        }
        state.clientes[index] = persistResult.cliente || clienteAtualizado;
        showToast('Cliente atualizado com sucesso!');
    } else {
        const novoCliente = {
            id: String(Date.now()),
            nome, matricula, cpf, dataNascimento: nasc, telefone: tel, email,
            renda, percentualLimiteRenda, limite, limiteParcelado, limiteCartao,
            limitesTipos,
            tipoLimite, diaVencimento: diaVenc, obs,
            tipoPagamento, banco, agencia, operacao, conta, chavePix,
            status: 'ativo',
            dataCadastro: new Date().toISOString().split('T')[0],
            scoreManual: null,
            scoreGestor: null,
            scoreCredito: 500,
            pagamentosEmDia: 0,
            blacklist: false,
            motivoBloqueio: '',
            contatos: []
        };
        const persistResult = await persistCliente(novoCliente);
        if (!persistResult || persistResult.success !== true) {
            showToast(`Falha ao cadastrar cliente: ${persistResult?.error || 'erro desconhecido'}`, 'error');
            return;
        }
        state.clientes.push(persistResult.cliente || novoCliente);
        showToast('Cliente cadastrado com sucesso!');
    }

    closeModal('modal-cliente');
    e.target.reset();
    const activeNav = document.querySelector('.sidebar-nav-item.nav-active');
    if (activeNav && activeNav.id === 'nav-clientes') {
        renderClientes(document.getElementById('app-content'));
    }
}

async function deleteCliente(id) {
    if (state.emprestimos.some(e => e.clienteId === id && (e.statusGeral === 'ativo' || e.statusGeral === 'atrasado'))) {
        alert("Não pode excluir cliente com dívidas ativas.");
        return;
    }
    if (confirm("Excluir cliente?")) {
        const persistResult = await persistDeleteCliente(id);
        if (!persistResult || persistResult.success !== true) {
            showToast(`Falha ao excluir cliente: ${persistResult?.error || 'erro desconhecido'}`, 'error');
            return;
        }
        state.clientes = state.clientes.filter(c => c.id !== id);
        if (window.invalidateClienteMap) window.invalidateClienteMap();
        showToast("Cliente removido.");
        const activeNav = document.querySelector('.sidebar-nav-item.nav-active');
        if (activeNav && activeNav.id === 'nav-clientes') {
            renderClientes(document.getElementById('app-content'));
        }
    }
}

function closeModal(id) { document.getElementById(id).close(); }
function openModal(id) {
    const el = document.getElementById(id);
    el.showModal();
    // Renderizar ícones APS o modal aparecer, sem bloquear o input
    setTimeout(() => refreshIcons(), 16);
}
