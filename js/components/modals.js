(function() {
    'use strict';
    const container = document.createElement('div');
    container.id = 'dynamic-modals-container';
    container.innerHTML = `
    <!-- MODAL: CONFIGURAÇÕES (IDENTIDADE) -->
    <dialog id="modal-config" class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-4xl glass-modal">
        <div class="bg-white dark:bg-slate-800 p-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <i data-lucide="settings" class="text-slate-500"></i> Configurações
                </h3>
                <button onclick="closeModal('modal-config')" class="text-slate-400 hover:text-slate-600"><i
                        data-lucide="x"></i></button>
            </div>

            <!-- Tabs -->
            <div class="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-3 flex-wrap">
                <button onclick="showConfigTab('operacoes')" id="tab-operacoes"
                    class="config-tab px-4 py-2 text-sm font-bold rounded-lg bg-cyan-100 text-cyan-700">Operações</button>
                <button onclick="showConfigTab('empresa')" id="tab-empresa"
                    class="config-tab px-4 py-2 text-sm font-bold rounded-lg text-slate-500 hover:bg-slate-100">Empresa</button>
                <button onclick="showConfigTab('taxas')" id="tab-taxas"
                    class="config-tab px-4 py-2 text-sm font-bold rounded-lg text-slate-500 hover:bg-slate-100">Taxas</button>
                <button onclick="showConfigTab('tipos')" id="tab-tipos"
                    class="config-tab px-4 py-2 text-sm font-bold rounded-lg text-slate-500 hover:bg-slate-100">Tipos de
                    Crédito</button>
                <button onclick="showConfigTab('seguranca')" id="tab-seguranca"
                    class="config-tab px-4 py-2 text-sm font-bold rounded-lg text-slate-500 hover:bg-slate-100">Segurança</button>
            </div>

            <!-- Tab Operações -->
            <div id="config-operacoes">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button type="button" onclick="baixarFechamentoDia()"
                        class="config-action-btn config-action-primary">
                        <span class="config-action-icon bg-violet-500/15 text-violet-300 border-violet-400/30">
                            <i data-lucide="package-check" class="w-5 h-5"></i>
                        </span>
                        <span class="min-w-0 text-left">
                            <span class="config-action-title">Fechamento</span>
                            <span class="config-action-copy">ZIP com comprovantes e resumo do dia</span>
                        </span>
                    </button>
                    <button type="button" onclick="abrirModalBackupLocal()"
                        class="config-action-btn">
                        <span class="config-action-icon bg-sky-500/15 text-sky-300 border-sky-400/30">
                            <i data-lucide="hard-drive" class="w-5 h-5"></i>
                        </span>
                        <span class="min-w-0 text-left">
                            <span class="config-action-title">Backup</span>
                            <span class="config-action-copy">Configurar e executar backup local</span>
                        </span>
                    </button>
                    <button type="button" onclick="salvarNoPendrive()"
                        class="config-action-btn config-action-warning">
                        <span class="config-action-icon bg-amber-400/20 text-amber-200 border-amber-300/40">
                            <i data-lucide="hard-drive-download" class="w-5 h-5"></i>
                        </span>
                        <span class="min-w-0 text-left">
                            <span class="config-action-title">Salvar USB</span>
                            <span class="config-action-copy">Gerar arquivo para pendrive ou disco externo</span>
                        </span>
                    </button>
                    <button type="button" onclick="restaurarDoPendrive()"
                        class="config-action-btn">
                        <span class="config-action-icon bg-slate-500/20 text-slate-200 border-slate-400/30">
                            <i data-lucide="hard-drive-upload" class="w-5 h-5"></i>
                        </span>
                        <span class="min-w-0 text-left">
                            <span class="config-action-title">Abrir USB</span>
                            <span class="config-action-copy">Restaurar backup JSON selecionado</span>
                        </span>
                    </button>
                    <button type="button" onclick="verificarAtualizacoes()"
                        class="config-action-btn">
                        <span class="config-action-icon bg-cyan-500/15 text-cyan-200 border-cyan-400/30">
                            <i data-lucide="download-cloud" class="w-5 h-5"></i>
                        </span>
                        <span class="min-w-0 text-left">
                            <span class="config-action-title">Atualizacoes</span>
                            <span class="config-action-copy">Verificar nova versao no GitHub Releases</span>
                        </span>
                    </button>
                </div>
            </div>

            <!-- Tab Empresa -->
            <div id="config-empresa" class="hidden">
                <form onsubmit="salvarConfiguracoes(event)" class="space-y-4">
                    <div
                        class="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800 mb-4">
                        <p class="text-xs text-blue-700 dark:text-blue-300">Essas informações aparecerão nos
                            <strong>Recibos PDF</strong> e nos registros internos.
                        </p>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nome
                            Fantasia da Empresa</label>
                        <input type="text" id="conf-nome" required placeholder="Ex: CrediRápido"
                            class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Telefone de
                            Contato / PIX</label>
                        <input type="text" id="conf-tel" required placeholder="Ex: (11) 99999-9999"
                            class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                    </div>
                    <div
                        class="mt-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Clientes Sem Novo
                                    Empréstimo</p>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Gera alerta no painel e
                                    prepara mensagem amigável para envio com aprovação.</p>
                            </div>
                            <label
                                class="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <input id="conf-inatividade-ativo" type="checkbox"
                                    class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    checked>
                                Ativo
                            </label>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Avisar
                                após quantos meses sem novo empréstimo</label>
                            <input type="number" id="conf-inatividade-meses" min="1" max="24" step="1" value="2"
                                class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                        </div>
                        <div>
                            <label
                                class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Mensagem
                                padrão (editável)</label>
                            <textarea id="conf-inatividade-msg" rows="4"
                                class="w-full input-premium rounded-xl p-3 text-sm font-medium"
                                placeholder="Olá {nome}, sentimos sua falta! Faz {meses} meses desde seu último empréstimo. Se precisar, estamos à disposição. - {empresa}"></textarea>
                            <p class="text-[11px] text-slate-500 mt-1">Use: <code>{nome}</code>, <code>{meses}</code>,
                                <code>{empresa}</code>, <code>{ultimo_emprestimo}</code>.
                            </p>
                        </div>
                    </div>
                    <div class="pt-4 flex justify-end">
                        <button type="submit"
                            class="px-6 py-2.5 text-sm font-bold bg-slate-800 dark:bg-slate-700 text-white rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 shadow-lg transition-all">Salvar</button>
                    </div>
                </form>
            </div>

            <!-- Tab Taxas -->
            <div id="config-taxas" class="hidden">
                <div
                    class="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 mb-4">
                    <p class="text-xs text-emerald-700 dark:text-emerald-300">
                        Defina os valores que entram automaticamente ao abrir um novo empréstimo. Cada contrato salva
                        sua própria regra de multa no momento da criação.
                    </p>
                </div>

                <div class="space-y-5">
                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Juros padrão</p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Avulso 20 dias (%)</label>
                                <input type="number" id="conf-taxa-avulso-20" min="0" step="0.1"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Avulso 30 dias (%)</label>
                                <input type="number" id="conf-taxa-avulso-30" min="0" step="0.1"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Parcelado (%)</label>
                                <input type="number" id="conf-taxa-parcelado" min="0" step="0.1"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Cartão (%)</label>
                                <input type="number" id="conf-taxa-cartao" min="0" step="0.1"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Outros tipos (%)</label>
                                <input type="number" id="conf-taxa-outros" min="0" step="0.1"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Parcelas padrão</label>
                                <input type="number" id="conf-qtd-parcelas" min="2" step="1"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Multa por atraso</p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Carência (dias)</label>
                                <input type="number" id="conf-carencia-dias" min="0" step="1"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Multa diária (%)</label>
                                <input type="number" id="conf-multa-diaria" min="0" step="0.1"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Multa fixa (R$)</label>
                                <input type="number" id="conf-multa-fixa" min="0" step="0.01"
                                    class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Impressão</p>
                        <select id="conf-print-format"
                            class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                            <option value="a4">A4 / PDF padrão</option>
                            <option value="thermal80">Bobina térmica 80mm</option>
                            <option value="thermal58">Bobina térmica 58mm</option>
                        </select>
                    </div>
                </div>

                <div class="pt-6 flex justify-end">
                    <button type="button" onclick="salvarTemplatesTaxas()"
                        class="px-6 py-2.5 text-sm font-bold bg-slate-800 dark:bg-slate-700 text-white rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 shadow-lg transition-all">
                        Salvar taxas
                    </button>
                </div>
            </div>

            <!-- Tab Tipos de Crédito -->
            <div id="config-tipos" class="hidden">
                <div
                    class="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800 mb-4">
                    <p class="text-xs text-blue-700 dark:text-blue-300">
                        Personalize a <strong>nomenclatura</strong> dos 3 tipos padrão do sistema e, opcionalmente,
                        adicione <strong>tipos extras</strong> (usam o limite base do cliente).
                    </p>
                </div>

                <div class="space-y-3 mb-5">
                    <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tipos padrão (apenas rótulo
                        editável)</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Rótulo
                                do tipo "avulso"</label>
                            <input type="text" id="conf-tipo-label-avulso" maxlength="40" placeholder="Avulso"
                                class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Rótulo
                                do tipo "parcelado"</label>
                            <input type="text" id="conf-tipo-label-parcelado" maxlength="40" placeholder="Parcelado"
                                class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Rótulo
                                do tipo "cartão"</label>
                            <input type="text" id="conf-tipo-label-cartao" maxlength="40" placeholder="Cartão"
                                class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                        </div>
                    </div>
                </div>

                <div class="mt-6">
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tipos extras (uso do
                            limite base)</p>
                        <button type="button" onclick="adicionarTipoExtra()"
                            class="text-xs font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
                            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Adicionar tipo
                        </button>
                    </div>
                    <div id="conf-tipos-extras-lista" class="space-y-2"></div>
                    <p class="text-[11px] text-slate-400 mt-2">
                        Ex.: "FGTS", "Consignado", "Cheque Especial". A chave interna é gerada do rótulo.
                    </p>
                </div>

                <div class="pt-6 flex justify-end">
                    <button type="button" onclick="salvarTiposCredito()"
                        class="px-6 py-2.5 text-sm font-bold bg-slate-800 dark:bg-slate-700 text-white rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 shadow-lg transition-all">
                        Salvar tipos
                    </button>
                </div>
            </div>

            <!-- Tab Segurança -->
            <div id="config-seguranca" class="hidden">
                <form onsubmit="alterarSenha(event)" class="space-y-4">
                    <div
                        class="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-xl border border-amber-100 dark:border-amber-800 mb-4">
                        <p class="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                            <i data-lucide="shield" class="w-4 h-4"></i>
                            Altere sua senha de acesso ao sistema
                        </p>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Senha
                            Atual</label>
                        <input type="password" id="conf-senha-atual" required
                            class="w-full input-premium rounded-xl p-3 text-sm font-medium"
                            placeholder="Digite sua senha atual">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nova
                            Senha</label>
                        <input type="password" id="conf-senha-nova" required minlength="6"
                            class="w-full input-premium rounded-xl p-3 text-sm font-medium"
                            placeholder="Mínimo 6 caracteres">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Confirmar
                            Nova Senha</label>
                        <input type="password" id="conf-senha-confirmar" required minlength="6"
                            class="w-full input-premium rounded-xl p-3 text-sm font-medium"
                            placeholder="Repita a nova senha">
                    </div>
                    <div id="senha-feedback" class="hidden p-3 rounded-xl text-sm font-bold"></div>
                    <div class="pt-4 flex justify-end">
                        <button type="submit"
                            class="px-6 py-2.5 text-sm font-bold bg-amber-600 text-white rounded-xl hover:bg-amber-500 shadow-lg transition-all flex items-center gap-2">
                            <i data-lucide="lock" class="w-4 h-4"></i> Alterar Senha
                        </button>
                    </div>
                </form>

                <div class="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <p class="text-xs text-slate-500 font-bold uppercase mb-2">Recuperação de Acesso</p>
                    <p class="text-xs text-slate-400 dark:text-slate-500 mb-3">Esqueceu sua senha? Use a <strong>Senha
                            Master</strong> ou <strong>Senha Desenvolvedor</strong> para liberar novo cadastro.</p>
                    <button onclick="resetarSenha()"
                        class="w-full p-3 text-sm font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors flex items-center justify-center gap-2">
                        <i data-lucide="key" class="w-4 h-4"></i> Recuperar Acesso (Senha Master / Dev)
                    </button>
                </div>

                <div
                    class="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p class="text-xs font-bold text-slate-500 mb-2">ℹ️ Informações do Banco de Dados</p>
                    <p class="text-xs text-slate-400" id="db-info-text">Armazenamento: SQLite local (SSD)</p>
                    <button onclick="loadDbStats()"
                        class="mt-2 text-xs text-emerald-600 hover:text-emerald-500 font-bold">Ver estatísticas
                        →</button>
                    <div id="db-stats-area" class="hidden mt-2 text-xs text-slate-400 space-y-1"></div>
                </div>

                <div
                    class="mt-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/60">
                    <p class="text-xs font-bold text-red-600 dark:text-red-300 uppercase mb-2">Reset do sistema</p>
                    <p class="text-xs text-red-700/80 dark:text-red-200/70 mb-3">
                        Apaga clientes, contratos, transações, caixa, recibos, arquivos e logs locais. O login do gestor
                        fica preservado.
                    </p>
                    <button type="button" onclick="resetTotal()"
                        class="w-full p-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center justify-center gap-2">
                        <i data-lucide="trash-2" class="w-4 h-4"></i> Resetar dados locais
                    </button>
                </div>
            </div>
        </div>
    </dialog>

    <!-- MODAL: APORTE (CAIXA) -->
    <dialog id="modal-aporte" class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-sm glass-modal">
        <div class="bg-white dark:bg-slate-800 p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <i data-lucide="wallet" class="w-5 h-5"></i> Adicionar Capital
                </h3>
                <button onclick="closeModal('modal-aporte')" class="text-slate-400 hover:text-slate-600"><i
                        data-lucide="x"></i></button>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Insira dinheiro no caixa para poder realizar
                novos empréstimos.</p>
            <form onsubmit="realizarAporte(event)">
                <div class="mb-4">
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Valor do Aporte (R$)</label>
                    <input type="number" id="valor-aporte" step="0.01" min="1" required
                        class="w-full text-2xl font-black text-emerald-600 input-premium rounded-xl p-3 placeholder-slate-300"
                        placeholder="0,00">
                </div>
                <div class="mb-4">
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Origem / Descrição</label>
                    <input type="text" id="desc-aporte" value="Aporte de Capital" required
                        class="w-full input-premium rounded-xl p-3 text-sm">
                </div>
                <button type="submit" class="w-full btn-premium py-3 rounded-xl shadow-lg transition-all">
                    Confirmar Depósito
                </button>
            </form>
        </div>
    </dialog>

    <!-- MODAL: CALCULADORA AVANÇADA -->
    <dialog id="modal-calculadora"
        class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-lg glass-modal">
        <div class="bg-white dark:bg-slate-800 p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <i data-lucide="calculator" class="w-6 h-6"></i> Calculadora de Juros Compostos
                </h3>
                <button onclick="closeModal('modal-calculadora')" class="text-slate-400 hover:text-slate-600"><i
                        data-lucide="x"></i></button>
            </div>

            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Capital Inicial
                            (R$)</label>
                        <input type="number" id="calc-adv-capital" step="0.01" placeholder="1000"
                            class="w-full input-premium rounded-xl p-3 text-lg font-bold"
                            oninput="calcularJurosCompostos()">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa de Juros (%)</label>
                        <input type="number" id="calc-adv-taxa" step="0.1" value="30"
                            class="w-full input-premium rounded-xl p-3 text-lg font-bold"
                            oninput="calcularJurosCompostos()">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Período (Meses)</label>
                        <input type="number" id="calc-adv-periodo" value="1" min="1"
                            class="w-full input-premium rounded-xl p-3" oninput="calcularJurosCompostos()">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Juros</label>
                        <select id="calc-adv-tipo" class="w-full input-premium rounded-xl p-3"
                            onchange="calcularJurosCompostos()">
                            <option value="simples">Simples</option>
                            <option value="composto">Composto</option>
                        </select>
                    </div>
                </div>

                <div
                    class="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 p-5 rounded-2xl border border-purple-200 dark:border-purple-700">
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p class="text-[10px] font-bold text-purple-500 uppercase">Juros Total</p>
                            <p class="text-lg font-black text-purple-700 dark:text-purple-300" id="calc-adv-juros">R$
                                0,00</p>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold text-indigo-500 uppercase">Montante Final</p>
                            <p class="text-xl font-black text-indigo-700 dark:text-indigo-300" id="calc-adv-montante">R$
                                0,00</p>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold text-teal-500 uppercase">Parcela Mensal</p>
                            <p class="text-lg font-black text-teal-700 dark:text-teal-300" id="calc-adv-parcela">R$ 0,00
                            </p>
                        </div>
                    </div>
                </div>

                <div id="calc-adv-tabela"
                    class="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600">
                    <!-- Tabela de evolução -->
                </div>
            </div>
        </div>
    </dialog>

    <!-- MODAL: DETALHES DE LIMITES POR TIPO (Cliente) -->
    <dialog id="modal-limites-cliente"
        class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-xl glass-modal">
        <div class="bg-white dark:bg-slate-800">
            <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <i data-lucide="layers" class="w-5 h-5 text-brand-500"></i> Limites / Uso do Cliente
                    </h3>
                    <p class="text-sm text-slate-500 mt-1" id="limites-cliente-nome">—</p>
                </div>
                <button onclick="closeModal('modal-limites-cliente')" class="text-slate-400 hover:text-slate-600">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="p-6 max-h-[70vh] overflow-y-auto">
                <div id="limites-cliente-content" class="space-y-3"></div>
            </div>
            <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                <button onclick="closeModal('modal-limites-cliente')"
                    class="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                    Fechar
                </button>
            </div>
        </div>
    </dialog>

    <!-- MODAL: BLACKLIST -->
    <dialog id="modal-blacklist"
        class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-2xl glass-modal">
        <div class="bg-white dark:bg-slate-800">
            <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                        <i data-lucide="shield-ban" class="w-6 h-6"></i> Lista de Bloqueados
                    </h3>
                    <p class="text-sm text-slate-500 mt-1">Bloqueio manual (pelo gestor) ou automático (score zerado /
                        inadimplência grave)</p>
                </div>
                <button onclick="closeModal('modal-blacklist')"
                    class="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"><i
                        data-lucide="x"></i></button>
            </div>
            <div class="p-6 max-h-[70vh] overflow-y-auto" id="blacklist-content"></div>
        </div>
    </dialog>

    <!-- MODAL: CRM CONTATOS -->
    <dialog id="modal-crm" class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-2xl glass-modal">
        <div class="bg-white dark:bg-slate-800">
            <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <i data-lucide="message-square-text" class="w-6 h-6"></i> Registro de Contatos
                    </h3>
                    <p class="text-sm text-slate-500 mt-1" id="crm-subtitle">Histórico de interações com o cliente</p>
                </div>
                <button onclick="closeModal('modal-crm')"
                    class="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"><i
                        data-lucide="x"></i></button>
            </div>
            <div class="p-6">
                <form onsubmit="salvarContatoCRM(event)" class="flex gap-2 mb-4">
                    <input type="hidden" id="crm-cliente-id">
                    <select id="crm-tipo"
                        class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 text-sm font-medium">
                        <option value="ligacao">📞 Ligação</option>
                        <option value="whatsapp">💬 Mensagem</option>
                        <option value="visita">🏠 Visita</option>
                        <option value="promessa">🤝 Promessa</option>
                        <option value="outro">📝 Outro</option>
                    </select>
                    <input type="text" id="crm-nota" placeholder="Ex: Disse que paga sexta-feira..."
                        class="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 text-sm"
                        required>
                    <button type="submit"
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-colors">Salvar</button>
                </form>
                <div class="max-h-[50vh] overflow-y-auto space-y-2" id="crm-historico"></div>
            </div>
        </div>
    </dialog>

    <!-- MODAL: DASHBOARD COBRANÇA DO DIA -->
    <dialog id="modal-cobranca-dia"
        class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-3xl glass-modal">
        <div class="bg-white dark:bg-slate-800">
            <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <i data-lucide="megaphone" class="w-6 h-6"></i> Cobrança do Dia
                    </h3>
                    <p class="text-sm text-slate-500 mt-1" id="cobranca-dia-subtitle">Clientes que precisam ser cobrados
                        hoje</p>
                </div>
                <button onclick="closeModal('modal-cobranca-dia')"
                    class="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"><i
                        data-lucide="x"></i></button>
            </div>
            <div class="p-6 max-h-[70vh] overflow-y-auto" id="cobranca-dia-content"></div>
        </div>
    </dialog>

    <!-- MODAL: AGENDA DE COBRANÇAS -->
    <dialog id="modal-agenda" class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-2xl glass-modal">
        <div class="bg-white dark:bg-slate-800">
            <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <i data-lucide="calendar-clock" class="w-6 h-6"></i> Agenda de Cobranças
                    </h3>
                    <p class="text-sm text-slate-500 mt-1">Próximos vencimentos e cobranças pendentes</p>
                </div>
                <button onclick="closeModal('modal-agenda')"
                    class="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"><i
                        data-lucide="x"></i></button>
            </div>

            <div class="p-6 max-h-[70vh] overflow-y-auto" id="agenda-content">
                <!-- Conteúdo dinâmico -->
            </div>
        </div>
    </dialog>

    <!-- MODAL: RELATÓRIOS -->
    <dialog id="modal-relatorios"
        class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-3xl glass-modal">
        <div class="bg-white dark:bg-slate-800">
            <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-bold flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                        <i data-lucide="file-bar-chart" class="w-6 h-6"></i> Central de Relatórios
                    </h3>
                    <p class="text-sm text-slate-500 mt-1">Exporte e analise seus dados</p>
                </div>
                <button onclick="closeModal('modal-relatorios')"
                    class="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"><i
                        data-lucide="x"></i></button>
            </div>

            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Relatório de Clientes -->
                    <div class="p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer group"
                        onclick="gerarRelatorioClientes()">
                        <div class="flex items-center gap-4">
                            <div
                                class="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-xl group-hover:scale-110 transition-transform">
                                <i data-lucide="users" class="w-6 h-6 text-emerald-600 dark:text-emerald-400"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 dark:text-slate-200">Relatório de Clientes</h4>
                                <p class="text-xs text-slate-500">Lista completa com limites e status</p>
                            </div>
                        </div>
                    </div>

                    <!-- Relatório de Empréstimos -->
                    <div class="p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all cursor-pointer group"
                        onclick="gerarRelatorioEmprestimos()">
                        <div class="flex items-center gap-4">
                            <div
                                class="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl group-hover:scale-110 transition-transform">
                                <i data-lucide="banknote" class="w-6 h-6 text-blue-600 dark:text-blue-400"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 dark:text-slate-200">Relatório de Empréstimos</h4>
                                <p class="text-xs text-slate-500">Todos os contratos ativos e finalizados</p>
                            </div>
                        </div>
                    </div>

                    <!-- Relatório Financeiro -->
                    <div class="p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all cursor-pointer group"
                        onclick="gerarRelatorioFinanceiro()">
                        <div class="flex items-center gap-4">
                            <div
                                class="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl group-hover:scale-110 transition-transform">
                                <i data-lucide="trending-up" class="w-6 h-6 text-purple-600 dark:text-purple-400"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 dark:text-slate-200">Relatório Financeiro</h4>
                                <p class="text-xs text-slate-500">Fluxo de caixa e lucros</p>
                            </div>
                        </div>
                    </div>

                    <!-- Relatório de Inadimplência -->
                    <div class="p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all cursor-pointer group"
                        onclick="gerarRelatorioInadimplencia()">
                        <div class="flex items-center gap-4">
                            <div
                                class="p-3 bg-red-100 dark:bg-red-900 rounded-xl group-hover:scale-110 transition-transform">
                                <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600 dark:text-red-400"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 dark:text-slate-200">Relatório de Inadimplência</h4>
                                <p class="text-xs text-slate-500">Devedores e valores em atraso</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Backup Completo</p>
                            <p class="text-xs text-slate-500">Exportar todos os dados em JSON</p>
                        </div>
                        <button onclick="exportData()"
                            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i> Exportar JSON
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </dialog>

    <!-- MODAL: ANALISTA FINANCEIRO (AI) -->
    <dialog id="modal-analista"
        class="rounded-3xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-4xl glass-modal m-auto overflow-hidden">
        <div class="flex h-[85vh] md:h-auto overflow-hidden flex-col md:flex-row">
            <!-- Coluna Esquerda: Perfil -->
            <div class="w-full md:w-1/3 bg-slate-50/80 border-r border-slate-200/60 p-8 flex flex-col relative">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>

                <div class="mb-8 text-center relative">
                    <div class="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-xl mx-auto mb-4 flex items-center justify-center text-3xl font-black text-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden cursor-pointer relative group"
                        id="ai-avatar" onclick="document.getElementById('ai-foto-input').click()"
                        title="Clique para adicionar foto">
                        <img id="ai-foto-img" src="" class="w-full h-full object-cover hidden" alt="Foto do cliente">
                        <span id="ai-foto-letter">?</span>
                        <div
                            class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <i data-lucide="camera" class="w-6 h-6 text-white"></i>
                        </div>
                    </div>
                    <input type="file" id="ai-foto-input" hidden accept="image/*" onchange="handleClienteFoto(event)">
                    <h3 class="text-xl font-bold text-slate-800 mb-1" id="ai-nome">Nome do Cliente</h3>
                    <p class="text-sm font-medium text-slate-500 bg-slate-200/50 inline-block px-3 py-1 rounded-full"
                        id="ai-idade">-- anos</p>
                </div>

                <div class="space-y-5 flex-1">
                    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Score de Crédito
                            (AI)</p>
                        <div class="flex items-end justify-between mb-2">
                            <span class="text-3xl font-black text-slate-800 leading-none" id="ai-score">0</span>
                            <span class="text-xs font-bold text-slate-400 mb-1">/ 1000</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div id="ai-score-bar"
                                class="bg-slate-300 h-full rounded-full transition-all duration-1000 ease-out w-0">
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Tags
                            Comportamentais</p>
                        <div class="flex flex-wrap gap-2" id="ai-badges">
                            <!-- Badges inseridas via JS -->
                        </div>
                    </div>
                </div>

                <div class="mt-8 pt-5 border-t border-slate-200">
                    <div id="ai-recommendation"
                        class="p-4 rounded-xl text-center font-bold text-sm bg-slate-100 text-slate-500 shadow-inner">
                        Processando Análise...
                    </div>
                </div>
            </div>

            <!-- Coluna Direita: Radar e Dados -->
            <div class="w-full md:w-2/3 p-8 bg-white overflow-y-auto">
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h3 class="text-xl font-bold flex items-center gap-2 text-indigo-600">
                            <i data-lucide="brain-circuit" class="w-6 h-6"></i>
                            Inteligência Financeira
                        </h3>
                        <p class="text-xs text-slate-400 font-medium mt-1">Análise preditiva baseada em histórico</p>
                    </div>
                    <button onclick="closeModal('modal-analista')"
                        class="text-slate-300 hover:text-slate-500 p-2 rounded-full hover:bg-slate-50 transition-colors"><i
                            data-lucide="x" class="w-6 h-6"></i></button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Gráfico Radar -->
                    <div
                        class="aspect-square relative flex items-center justify-center p-4 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                        <canvas id="riskChart"></canvas>
                    </div>

                    <!-- Métricas Detalhadas -->
                    <div class="space-y-5 flex flex-col justify-center">
                        <div
                            class="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Vício em
                                    Crédito</span>
                                <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400" title="Risco de Rolagem"></i>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                                    <div id="bar-vicio"
                                        class="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full w-0">
                                    </div>
                                </div>
                                <span class="text-sm font-black w-10 text-right text-slate-700" id="val-vicio">0%</span>
                            </div>
                            <p class="text-[10px] text-slate-400 mt-2 font-medium">Probabilidade de rolagem de dívida
                            </p>
                        </div>

                        <div
                            class="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-center mb-2">
                                <span
                                    class="text-xs font-bold text-slate-600 uppercase tracking-wider">Comprometimento</span>
                                <i data-lucide="pie-chart" class="w-3.5 h-3.5 text-blue-400"></i>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                                    <div id="bar-comprometimento"
                                        class="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full w-0">
                                    </div>
                                </div>
                                <span class="text-sm font-black w-10 text-right text-slate-700"
                                    id="val-comprometimento">0%</span>
                            </div>
                            <p class="text-[10px] text-slate-400 mt-2 font-medium">Percentual do limite utilizado</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </dialog>

    <!-- MODAL: RECUPERAÇÃO DE SENHA (Master / Dev) -->
    <dialog id="modal-recovery" class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/70 w-full max-w-sm glass-modal">
        <div class="bg-white dark:bg-slate-800 p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold flex items-center gap-2 text-amber-600">
                    <i data-lucide="key" class="w-5 h-5"></i> Recuperação de Acesso
                </h3>
                <button onclick="closeModal('modal-recovery')" class="text-slate-400 hover:text-slate-600"><i
                        data-lucide="x"></i></button>
            </div>

            <div class="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl border border-blue-200 dark:border-blue-800 mb-4">
                <p class="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    <strong>Nível 1:</strong> Senha Master (8 caracteres)<br>
                    <strong>Nível 2:</strong> Senha Desenvolvedor (11 caracteres)<br><br>
                    Ao inserir uma senha válida, suas credenciais serão resetadas e você poderá fazer um novo cadastro.
                    <strong>Seus dados (clientes, contratos) NÃO serão afetados.</strong>
                </p>
            </div>

            <form onsubmit="handleRecoverySubmit(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Senha de
                        Recuperação</label>
                    <input type="password" id="recovery-password" required
                        class="w-full input-premium rounded-xl p-3 text-sm font-medium"
                        placeholder="Senha Master ou Desenvolvedor">
                </div>
                <div id="recovery-feedback" class="hidden p-3 rounded-xl text-sm font-bold"></div>
                <button type="submit"
                    class="w-full btn-premium py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg"
                    style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                    <i data-lucide="unlock" class="w-4 h-4"></i> Verificar e Liberar Acesso
                </button>
            </form>
        </div>
    </dialog>

    <!-- MODAL: BACKUP LOCAL -->
    <dialog id="modal-backup-local" class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/50 w-full max-w-md glass-modal">
        <div class="bg-white dark:bg-slate-800 p-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold flex items-center gap-2 text-blue-600">
                    <i data-lucide="hard-drive" class="w-6 h-6"></i> Backup Local
                </h3>
                <button onclick="closeModal('modal-backup-local')" class="text-slate-400 hover:text-slate-600"><i
                        data-lucide="x"></i></button>
            </div>

            <div id="backup-status-area"
                class="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-center font-medium text-slate-600">
                Backups e restauracoes sao feitos somente por arquivo local.
            </div>

            <div class="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700 space-y-3">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Backup fisico SQLite</p>
                        <p class="text-[11px] text-slate-500 mt-1">Copia rotativa do arquivo .db em pasta local, disco externo ou pendrive.</p>
                    </div>
                    <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <input id="backup-fisico-ativo" type="checkbox"
                            class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500">
                        Ativo
                    </label>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Diretorio de destino</label>
                    <div class="flex gap-2">
                        <input id="backup-physical-dir" type="text" readonly
                            class="flex-1 input-premium rounded-xl p-3 text-xs font-mono text-slate-700"
                            placeholder="Padrao: pasta backups do aplicativo">
                        <button type="button" onclick="escolherDiretorioBackupFisico()"
                            class="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700">
                            Escolher
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Reter copias</label>
                        <input id="backup-retencao" type="number" min="1" max="200" step="1"
                            class="w-full input-premium rounded-xl p-3 text-sm font-medium">
                    </div>
                    <div class="flex items-end">
                        <button type="button" onclick="salvarConfigBackupFisico()"
                            class="w-full px-3 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500">
                            Salvar config
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-3">
                <button onclick="salvarNoPendrive()"
                    class="w-full bg-emerald-600 text-white py-3.5 rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all">
                    <i data-lucide="hard-drive-download" class="w-5 h-5"></i>
                    <span class="text-xs font-extrabold uppercase">Salvar Copia SQLite</span>
                </button>
                <button onclick="forcarBackupFisico()"
                    class="w-full bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all">
                    <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                    <span class="text-xs font-extrabold uppercase">Executar Backup Rotativo Agora</span>
                </button>
                <button onclick="restaurarDoPendrive()"
                    class="w-full bg-white text-slate-700 border border-slate-200 py-3.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2 transition-all">
                    <i data-lucide="folder-open" class="w-5 h-5 text-slate-400"></i>
                    <span class="text-xs font-extrabold uppercase">Restaurar JSON Local</span>
                </button>
            </div>

            <p class="mt-5 text-[11px] leading-relaxed text-slate-500">
                Guarde copias em pendrive ou disco externo. O sistema nao envia dados para servidores externos.
            </p>
        </div>
    </dialog>

    <!-- MODAL: Novo Cliente -->
    <dialog id="modal-cliente"
        class="rounded-3xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-lg glass-modal overflow-hidden">
        <div class="bg-white dark:bg-slate-800 h-auto max-h-[90vh] overflow-y-auto">
            <div
                class="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 class="text-xl font-bold text-slate-800" id="modal-cliente-title">Novo Cliente</h3>
                <button onclick="closeModal('modal-cliente')"
                    class="text-slate-400 hover:text-red-500 transition-colors"><i data-lucide="x"></i></button>
            </div>
            <form id="form-cliente" onsubmit="handleNewCustomer(event)" class="p-8 space-y-6">
                <!-- Section 1 -->
                <div class="space-y-4">
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <i data-lucide="user" class="w-3 h-3"></i> Dados Pessoais (KYC)
                    </h4>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Nome Completo</label>
                        <input type="text" id="cliente-nome" required
                            class="w-full input-premium rounded-xl p-3 text-sm font-medium text-slate-800 placeholder-slate-400">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Matrícula</label>
                            <input type="text" id="cliente-matricula"
                                class="w-full input-premium rounded-xl p-3 text-sm text-slate-800"
                                placeholder="Ex.: MAT-20260409-A1B2">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">CPF / CNPJ</label>
                            <input type="text" id="cliente-cpf"
                                class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Data Nascimento</label>
                            <input type="date" id="cliente-nasc"
                                class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Telefone</label>
                            <input type="text" id="cliente-tel" required
                                class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                            <input type="email" id="cliente-email"
                                class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                        </div>
                    </div>

                </div>

                <!-- Section 2 -->
                <div class="pt-4 border-t border-slate-100 space-y-4">
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <i data-lucide="wallet" class="w-3 h-3"></i> Configuração Financeira
                    </h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Renda (R$)</label>
                            <div class="relative">
                                <span class="absolute left-3 top-3 text-slate-400 text-sm">R$</span>
                                <input type="number" id="cliente-renda" step="0.01" min="0"
                                    oninput="atualizarLimitePorRenda()"
                                    class="w-full input-premium rounded-xl pl-9 p-3 text-sm text-slate-800">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">% da Renda para
                                Limite</label>
                            <div class="relative">
                                <input type="number" id="cliente-percentual-renda" step="0.01" min="0" value="33.3333"
                                    oninput="atualizarLimitePorRenda()"
                                    class="w-full input-premium rounded-xl p-3 pr-8 text-sm text-slate-800">
                                <span class="absolute right-3 top-3 text-slate-400 text-sm">%</span>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Limite Aprovado
                                (R$)</label>
                            <div class="relative">
                                <span class="absolute left-3 top-3 text-slate-400 text-sm">R$</span>
                                <input type="number" id="cliente-limite" step="0.01" required
                                    class="w-full input-premium rounded-xl pl-9 p-3 text-sm font-bold text-slate-800">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Dia Vencimento</label>
                            <select id="cliente-dia-venc"
                                class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                                <option value="">Sem preferência</option>
                                <option value="5">Dia 05</option>
                                <option value="10">Dia 10</option>
                                <option value="15">Dia 15</option>
                                <option value="20">Dia 20</option>
                                <option value="25">Dia 25</option>
                                <option value="30">Dia 30</option>
                            </select>
                        </div>
                    </div>
                    <!-- Limites por tipo (dinâmico — gerado pelo JS com base nos tipos configurados) -->
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="block text-xs font-semibold text-slate-600">Limites por Tipo de
                                Crédito</label>
                            <span class="text-[10px] text-slate-400">Configure os tipos em "Configurações → Tipos de
                                Crédito"</span>
                        </div>
                        <div id="cliente-limites-por-tipo" class="grid grid-cols-2 gap-3"></div>
                        <!-- Inputs hidden mantidos para rotinas que leem por ID -->
                        <input type="hidden" id="cliente-limite-parcelado">
                        <input type="hidden" id="cliente-limite-cartao">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Regra de Cálculo de
                            Limite</label>
                        <select id="cliente-tipo-limite"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                            <option value="total" selected>Comprometer com Juros (Padrão)</option>
                            <option value="principal">Comprometer Apenas Principal</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Observações Internas</label>
                        <textarea id="cliente-obs" rows="2"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800"
                            placeholder="Anotações do gestor..."></textarea>
                    </div>
                </div>

                <!-- Section 3: Dados Bancários / PIX -->
                <div class="pt-4 border-t border-slate-100 space-y-4">
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <i data-lucide="landmark" class="w-3 h-3"></i> Dados para Transferência
                    </h4>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Tipo de Pagamento</label>
                        <select id="cliente-tipo-pag" onchange="toggleTransferenciaFields()"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                            <option value="">Nenhum</option>
                            <option value="ted">TED / DOC (Banco)</option>
                            <option value="pix">PIX</option>
                        </select>
                    </div>
                    <div id="campos-banco" class="hidden space-y-4">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Banco</label>
                                <select id="cliente-banco" onchange="toggleBancoOutro()"
                                    class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                                    <option value="">Selecione o banco</option>
                                    <option value="341 - Itaú Unibanco">341 - Itaú Unibanco</option>
                                    <option value="001 - Banco do Brasil">001 - Banco do Brasil</option>
                                    <option value="237 - Bradesco">237 - Bradesco</option>
                                    <option value="104 - Caixa Econômica Federal">104 - Caixa Econômica Federal</option>
                                    <option value="033 - Santander">033 - Santander</option>
                                    <option value="623 - Banco PAN">623 - Banco PAN</option>
                                    <option value="077 - Banco Inter">077 - Banco Inter</option>
                                    <option value="260 - Nubank">260 - Nubank</option>
                                    <option value="422 - Banco Safra">422 - Banco Safra</option>
                                    <option value="208 - BTG Pactual">208 - BTG Pactual</option>
                                    <option value="041 - Banrisul">041 - Banrisul</option>
                                    <option value="070 - BRB">070 - BRB</option>
                                    <option value="655 - Banco Votorantim (BV)">655 - Banco Votorantim (BV)</option>
                                    <option value="756 - Sicoob">756 - Sicoob</option>
                                    <option value="748 - Sicredi">748 - Sicredi</option>
                                    <option value="069 - Crefisa">069 - Crefisa</option>
                                    <option value="389 - Mercantil do Brasil">389 - Mercantil do Brasil</option>
                                    <option value="246 - ABC Brasil">246 - ABC Brasil</option>
                                    <option value="707 - Daycoval">707 - Daycoval</option>
                                    <option value="004 - Banco do Nordeste">004 - Banco do Nordeste</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </div>
                            <div id="campo-banco-outro" class="hidden">
                                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Nome do Banco</label>
                                <input type="text" id="cliente-banco-outro"
                                    class="w-full input-premium rounded-xl p-3 text-sm text-slate-800"
                                    placeholder="Digite o nome do banco">
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Agência</label>
                                <input type="text" id="cliente-agencia"
                                    class="w-full input-premium rounded-xl p-3 text-sm text-slate-800"
                                    placeholder="0001">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Operação</label>
                                <input type="text" id="cliente-operacao"
                                    class="w-full input-premium rounded-xl p-3 text-sm text-slate-800"
                                    placeholder="Ex: 013">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Conta</label>
                                <input type="text" id="cliente-conta"
                                    class="w-full input-premium rounded-xl p-3 text-sm text-slate-800"
                                    placeholder="12345-6">
                            </div>
                        </div>
                    </div>
                    <div id="campos-pix" class="hidden">
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Chave PIX</label>
                        <input type="text" id="cliente-chave-pix"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800"
                            placeholder="CPF, e-mail, telefone ou chave aleatória">
                    </div>
                </div>

                <div class="pt-4 flex justify-end gap-3">
                    <button type="button" onclick="closeModal('modal-cliente')"
                        class="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                    <button type="submit" id="btn-salvar-cliente"
                        class="px-6 py-2.5 text-sm font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-500 shadow-lg shadow-brand-500/25 transition-all transform hover:-translate-y-0.5">Salvar
                        Cadastro</button>
                </div>
            </form>
        </div>
    </dialog>

    <!-- MODAL: Novo Empréstimo -->
    <dialog id="modal-emprestimo"
        class="rounded-3xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-lg glass-modal">
        <div class="bg-white dark:bg-slate-800 p-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold flex items-center gap-2 text-slate-800"><i data-lucide="banknote"
                        class="text-emerald-500"></i> Novo Contrato</h3>
                <button onclick="closeModal('modal-emprestimo')" class="text-slate-400 hover:text-slate-600"><i
                        data-lucide="x"></i></button>
            </div>

            <div id="aviso-limite"
                class="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm mb-6 hidden animate-pulse">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-bold block mb-1 text-xs uppercase tracking-wide">Alerta de Limite</span>
                        <span id="val-disponivel" class="font-bold">R$ 0,00</span>
                    </div>
                    <button id="btn-override" onclick="showOverrideInput()"
                        class="hidden bg-white text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-extrabold hover:bg-red-50 transition-colors shadow-sm">
                        LIBERAR EXTRA
                    </button>
                </div>
                <div id="div-override-input" class="hidden mt-3 pt-3 border-t border-red-200">
                    <label class="block text-[10px] font-bold text-red-800 uppercase mb-1">Autorização (Nome do
                        Gestor)</label>
                    <input type="text" id="auth-gestor"
                        class="w-full rounded-lg border-red-300 border p-2 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white"
                        placeholder="Assinatura digital..." oninput="checkOverrideAuth()">
                </div>
            </div>

            <!-- Aviso de Menor de Idade -->
            <div id="aviso-menor"
                class="hidden bg-orange-50 border border-orange-100 text-orange-800 px-4 py-3 rounded-xl text-sm mb-6">
                <div class="flex items-center gap-2 font-bold mb-1"><i data-lucide="alert-triangle" class="w-4 h-4"></i>
                    Cliente Menor de Idade</div>
                <p class="text-xs mb-2">Atenção: este cliente tem <span id="aviso-menor-idade"></span> anos. Ao
                    confirmar, você assume a responsabilidade.</p>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="check-menor-confirm" class="accent-orange-600 w-4 h-4">
                    <span class="text-xs font-bold">Confirmo ciência e responsabilidade</span>
                </label>
            </div>

            <!-- Aviso de Caixa Insuficiente -->
            <div id="aviso-caixa"
                class="hidden bg-amber-50 border border-amber-100 text-amber-800 px-4 py-3 rounded-xl text-sm mb-6">
                <div class="flex items-center gap-2 font-bold mb-1"><i data-lucide="alert-triangle" class="w-4 h-4"></i>
                    Saldo em Caixa Insuficiente</div>
                <p class="text-xs mb-2">Você não tem dinheiro em caixa para emprestar esse valor.</p>
                <button onclick="abrirModalAporte()"
                    class="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">Adicionar
                    Capital</button>
            </div>

            <form onsubmit="handleNewLoan(event)" class="space-y-5">
                <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1.5">Cliente</label>
                    <input type="text" id="emp-cliente-busca" placeholder="Buscar cliente pelo nome..."
                        autocomplete="off"
                        class="w-full input-premium rounded-xl p-3 text-sm text-slate-800 bg-white mb-2"
                        oninput="filtrarClientesModal(this.value)">
                    <select id="emp-cliente" required onchange="checkLimitInfo()" size="5"
                        class="w-full input-premium rounded-xl p-2 text-sm text-slate-800 bg-white"
                        style="min-height:120px;">
                        <option value="">Selecione...</option>
                    </select>
                    <p id="modal-score-display" class="text-xs mt-2 font-medium hidden"></p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Valor (R$)</label>
                        <input type="number" id="emp-valor" step="0.01" required oninput="calcularSimulacao()"
                            class="w-full input-premium rounded-xl p-3 text-sm font-bold text-slate-800">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Tipo</label>
                        <select id="emp-tipo" onchange="toggleParcelas()"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                            <option value="avulso">Avulso</option>
                            <option value="parcelado">Parcelado</option>
                            <option value="cartao">Cartão</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Juros (%)</label>
                        <input type="number" id="emp-juros" step="0.1" value="0" required oninput="calcularSimulacao()"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                    </div>

                    <div id="div-avulso-opcoes">
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Prazo (Dias)</label>
                        <select id="emp-prazo-avulso" onchange="aplicarPlanoAvulso()"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                            <option value="20">20 Dias</option>
                            <option value="30" selected>30 Dias</option>
                        </select>
                    </div>

                    <div id="div-parcelas" class="hidden">
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Parcelas</label>
                        <input type="number" id="emp-qtd-parcelas" min="2" value="2" oninput="calcularSimulacao()"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Data Início</label>
                        <input type="date" id="emp-data" required onchange="calcularSimulacao()"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Multa Diária (%)</label>
                        <input type="number" id="emp-multa-diaria" step="0.1" value="1.0" min="0"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Carência (dias)</label>
                        <input type="number" id="emp-carencia-dias" step="1" value="5" min="0"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Multa Fixa (R$)</label>
                        <input type="number" id="emp-multa-fixa" step="0.01" value="0" min="0"
                            class="w-full input-premium rounded-xl p-3 text-sm text-slate-800">
                    </div>
                </div>

                <div class="bg-slate-50 p-5 rounded-2xl border border-slate-100 mt-2">
                    <div class="flex justify-between items-end">
                        <div>
                            <p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Valor Final Estimado</p>
                            <p class="text-2xl font-black text-brand-600 mt-1" id="sim-total">R$ 0,00</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-slate-500 mb-1" id="sim-desc-parcela">Pagamento Único</p>
                            <p class="text-lg font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200 inline-block shadow-sm"
                                id="sim-valor-parcela">R$ 0,00</p>
                        </div>
                    </div>
                    <p class="text-[10px] text-slate-400 mt-3 text-center border-t border-slate-200 pt-2"
                        id="sim-datas">Vencimento: -</p>
                </div>

                <div class="pt-4 border-t border-slate-100">
                    <label
                        class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <i data-lucide="clipboard-check" class="w-3 h-3"></i> Status de Aprovação
                    </label>
                    <div class="grid grid-cols-3 gap-2 mb-4">
                        <label
                            class="flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 border-slate-200 hover:border-slate-300">
                            <input type="radio" name="emp-aprovacao" value="aprovado" class="accent-emerald-600" checked
                                onchange="onAprovacaoChange()">
                            <span class="text-sm font-bold text-slate-700">✅ Aprovado</span>
                        </label>
                        <label
                            class="flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 border-slate-200 hover:border-slate-300">
                            <input type="radio" name="emp-aprovacao" value="em_analise" class="accent-amber-600"
                                onchange="onAprovacaoChange()">
                            <span class="text-sm font-bold text-slate-700">🔍 Em Análise</span>
                        </label>
                        <label
                            class="flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors has-[:checked]:border-red-500 has-[:checked]:bg-red-50 border-slate-200 hover:border-slate-300">
                            <input type="radio" name="emp-aprovacao" value="reprovado" class="accent-red-600"
                                onchange="onAprovacaoChange()">
                            <span class="text-sm font-bold text-slate-700">❌ Reprovado</span>
                        </label>
                    </div>
                </div>

                <div class="flex justify-end gap-3">
                    <button type="button" onclick="closeModal('modal-emprestimo')"
                        class="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                    <button type="submit" id="btn-submit-emprestimo"
                        class="px-6 py-2.5 text-sm font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-500 shadow-lg shadow-brand-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">Confirmar</button>
                </div>
            </form>
        </div>
    </dialog>

    <!-- MODAL: Pagamento / Detalhes (Refinado) -->
    <dialog id="modal-pagamento"
        class="rounded-3xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-3xl glass-modal">
        <div class="bg-white dark:bg-slate-800 flex flex-col max-h-[90vh]">
            <div
                class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                    <h3 class="text-xl font-bold text-slate-800 mb-1" id="det-cliente">Nome do Cliente</h3>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 bg-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase"
                            id="det-tipo">TIPO</span>
                        <div id="det-gestor-info" class="hidden">
                            <span
                                class="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-bold border border-blue-200 flex items-center gap-1">
                                <i data-lucide="user" class="w-3 h-3"></i>
                                Gestor: <span id="det-gestor-nome"></span>
                            </span>
                        </div>
                        <div id="det-auth-info" class="hidden">
                            <span
                                class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold border border-red-200 flex items-center gap-1">
                                <i data-lucide="shield-alert" class="w-3 h-3"></i>
                                Auth: <span id="det-auth-nome"></span>
                            </span>
                        </div>
                    </div>
                </div>
                <button onclick="closeModal('modal-pagamento')"
                    class="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-white transition-all"><i
                        data-lucide="x"></i></button>
            </div>

            <!-- Observação (aparece se houver texto salvo) -->
            <div id="det-obs-display"
                class="hidden px-6 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 flex items-start gap-2">
                <i data-lucide="message-square-text" class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"></i>
                <div class="flex-1 min-w-0">
                    <span
                        class="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-0.5">Observação</span>
                    <p id="det-obs-texto"
                        class="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap break-words"></p>
                </div>
            </div>

            <!-- Barra de Status de Aprovação -->
            <div class="px-6 py-3 bg-slate-50/80 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between"
                id="det-aprovacao-bar">
                <div class="flex items-center gap-2">
                    <i data-lucide="clipboard-check" class="w-4 h-4 text-slate-400"></i>
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Status de Aprovação:</span>
                    <span id="det-aprovacao-badge" class="badge">-</span>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="abrirObservacaoEmprestimo()"
                        class="text-xs font-bold rounded-lg border border-amber-200 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors flex items-center gap-1.5"
                        title="Adicionar ou editar observação">
                        <i data-lucide="message-square-plus" class="w-3.5 h-3.5"></i>
                        Observação
                    </button>
                    <select id="det-aprovacao-select" onchange="alterarAprovacao(this.value)"
                        class="text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-200 cursor-pointer">
                        <option value="aprovado">✅ Aprovado</option>
                        <option value="em_analise">🔍 Em Análise</option>
                        <option value="reprovado">❌ Reprovado</option>
                    </select>
                </div>
            </div>

            <!-- Modal inline de edição de observação -->
            <dialog id="modal-obs-emprestimo"
                class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/60 w-full max-w-md glass-modal">
                <div class="bg-white dark:bg-slate-800 p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-lg font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <i data-lucide="message-square-text" class="w-5 h-5"></i> Observação do Contrato
                        </h4>
                        <button onclick="closeModal('modal-obs-emprestimo')"
                            class="text-slate-400 hover:text-slate-600">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <textarea id="txt-obs-emprestimo" rows="5" maxlength="2000"
                        class="w-full input-premium rounded-xl p-3 text-sm"
                        placeholder="Digite uma observação sobre este contrato..."></textarea>
                    <p class="text-[10px] text-slate-400 mt-1">Máx. 2000 caracteres.</p>
                    <div class="flex justify-end gap-2 mt-4">
                        <button type="button" onclick="closeModal('modal-obs-emprestimo')"
                            class="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button type="button" onclick="salvarObservacaoEmprestimo()"
                            class="px-5 py-2 text-sm font-bold bg-amber-600 text-white rounded-xl hover:bg-amber-500 shadow-lg transition-all">
                            Salvar
                        </button>
                    </div>
                </div>
            </dialog>

            <div class="p-8 overflow-y-auto">
                <!-- Cards Resumo -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div class="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                        <p class="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Principal</p>
                        <p class="font-bold text-slate-800 text-lg" id="det-principal">R$ 0</p>
                    </div>
                    <div class="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
                        <p class="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Total (+Juros)
                        </p>
                        <p class="font-bold text-slate-800 text-lg" id="det-total">R$ 0</p>
                    </div>
                    <div class="bg-orange-50/50 border border-orange-100 p-4 rounded-2xl">
                        <p class="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-1">Restante</p>
                        <p class="font-bold text-slate-800 text-lg" id="det-restante">R$ 0</p>
                    </div>
                    <div class="bg-red-50/50 border border-red-100 p-4 rounded-2xl">
                        <p class="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-1">Multa Prev.</p>
                        <p class="font-bold text-red-600 text-lg" id="det-multa">R$ 0</p>
                    </div>
                </div>

                <div class="flex justify-between items-center mb-4">
                    <h4 class="font-bold text-slate-700 flex items-center gap-2">
                        <i data-lucide="list" class="w-4 h-4 text-slate-400"></i> Parcelas
                    </h4>
                    <button id="btn-quitar" onclick="quitarTudo()"
                        class="hidden text-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all font-bold">
                        Quitar Restante
                    </button>
                </div>

                <div class="border border-slate-100 rounded-2xl overflow-x-auto shadow-sm">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                            <tr>
                                <th class="px-5 py-3">#</th>
                                <th class="px-5 py-3">Vencimento</th>
                                <th class="px-5 py-3">Valor</th>
                                <th class="px-5 py-3">Multa</th>
                                <th class="px-5 py-3">Status</th>
                                <th class="px-5 py-3 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody id="lista-parcelas" class="divide-y divide-slate-50 bg-white">
                            <!-- JS popula aqui -->
                        </tbody>
                    </table>
                </div>

                        <!-- Zona de perigo — Excluir contrato -->
                <div class="mt-6 pt-4 border-t border-dashed border-red-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs font-bold text-red-600 uppercase tracking-wider">Zona de Perigo</p>
                            <p class="text-[11px] text-slate-500 mt-1">Excluir o contrato é irreversível. Se aplicável,
                                o valor é estornado ao caixa.</p>
                        </div>
                        <button type="button" onclick="excluirContratoAtual()"
                            class="px-3 py-2 text-xs font-bold border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors flex items-center gap-2">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Excluir Contrato
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </dialog>

    <!-- MODAL: SENHA MESTRE (Reativar Cliente) -->
    <dialog id="modal-senha-mestre"
        class="rounded-2xl shadow-2xl p-0 backdrop:bg-slate-900/70 w-full max-w-sm glass-modal">
        <div class="bg-white dark:bg-slate-800 p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold flex items-center gap-2 text-amber-600">
                    <i data-lucide="shield-check" class="w-5 h-5"></i> Senha Mestre
                </h3>
                <button onclick="closeModal('modal-senha-mestre')" class="text-slate-400 hover:text-slate-600"><i
                        data-lucide="x"></i></button>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-4" id="senha-mestre-msg">Digite a senha mestre para
                reativar o cliente.</p>
            <form onsubmit="confirmarSenhaMestre(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Senha
                        Mestre</label>
                    <input type="password" id="senha-mestre-input" required
                        class="w-full input-premium rounded-xl p-3 text-sm font-medium"
                        placeholder="Digite a senha mestre..." autocomplete="off">
                </div>
                <div id="senha-mestre-erro"
                    class="hidden p-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200">Senha
                    incorreta!</div>
                <button type="submit"
                    class="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all"
                    style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                    <i data-lucide="unlock" class="w-4 h-4"></i> Confirmar e Reativar
                </button>
            </form>
        </div>
    </dialog>
    `;
    document.body.appendChild(container);
})();
