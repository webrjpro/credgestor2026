# Changelog - CredGestor

Formato: SemVer.

## [6.0.2] - 2026-06-20

### Atualizacao - 2026-06-20

- Corrigido empacotamento do backend local no instalador: dependencias runtime do backend agora sao copiadas para `resources/backend/node_modules`.
- Corrigida inicializacao via terminal/app instalado com `scripts/start-electron.js`, removendo conflito com `ELECTRON_RUN_AS_NODE`.
- Corrigido carregamento do tema no renderer, garantindo ordem correta entre `auth.js` e `ui-system.js`.
- Corrigido retorno nulo de credenciais no fluxo de autenticacao local.
- Corrigido reset total para usar modal proprio em vez de `prompt()`, com confirmacao digitando `RESETAR`.
- Ajustada tabela de clientes para manter a coluna de acoes visivel e evitar corte de contato/numero.
- Dashboard Financeiro recebeu faixa executiva com atalhos para Operacoes, Cobrancas, Esteira e Recibos.
- Adicionada Central de Operacoes para consolidar cobrancas, aprovacao, recibos, risco, caixa e bloqueios.
- Adicionada Esteira de Contratos por etapa: em analise, aprovado, impresso/arquivo, reprovado e finalizado.
- Adicionada Central de Recibos com filtros de pendentes, entregues, estornados e todos.
- Adicionada Timeline do Cliente com historico de cadastro, contratos, pagamentos, atrasos, CRM e bloqueios.
- Adicionada Busca Global no topo com atalho `Ctrl+K` para localizar clientes, contratos e recibos.
- Atualizada padronizacao visual das novas telas com paineis compactos, cards menores, modais e botoes consistentes.
- Removidas senhas mestre/desenvolvedor em texto claro do codigo-fonte; verificacoes passam a usar hashes e IPC centralizado.
- Adicionado auto-update remoto via GitHub Releases usando instalador NSIS, `latest.yml` e `electron-updater`.
- Adicionado painel visual de atualizacao no app com progresso de download e acao para reiniciar/instalar.
- Adicionado workflow `.github/workflows/release.yml` para gerar release Windows automaticamente ao publicar tags `v*`.
- Corrigida codificacao da tela de acordo de licenca do instalador NSIS usando arquivo ASCII compativel.
- Instalador Inno atualizado em `dist/CredGestor-InnoSetup-6.0.2.exe`.

### Release

- Release limpo do CredGestor para Windows x64, com nome, instalador e metadados padronizados como `CredGestor`.
- Instalador Inno gerado como `CredGestor-InnoSetup-6.0.2.exe`.
- Remocao de residuos de build e bancos locais de reparo (`scratch/` e `backend/data/`).
- Atualizacao de documentacao, instalador, interface e pipeline remoto para a versao 6.0.2.

### Arquitetura

- Caixa virou ledger central no backend, com movimentos transacionais e bloqueio de saldo insuficiente.
- Criacao, aprovacao, exclusao e pagamento de emprestimos passaram a sincronizar caixa pelo backend.
- Pagamento de parcela agora atualiza emprestimo, transacao, caixa e score do cliente em uma operacao atomica.
- Score de credito e blacklist automatica sairam do renderer e foram centralizados em `backend/src/services/clientes.service.js`.
- Bloqueio e desbloqueio manual de cliente passaram a usar endpoint proprio (`PUT /api/clientes/:id/blacklist`) e IPC dedicado.
- `motivoBloqueio` agora possui coluna real no SQLite, exportacao e restauracao por backup.
- O processo principal aguarda o backend local ficar pronto e aplica retry nas chamadas IPC para evitar `fetch failed` no primeiro cadastro/login.
- O renderer deixou de fazer HTTP direto para o backend; a comunicacao operacional passa por `window.db` via preload e main process.
- O cliente HTTP direto do renderer foi removido por nao ser mais parte da arquitetura desktop offline.
- A gestao de usuarios agora usa rota local real (`/api/tenants`) e IPC dedicado, sem endpoints inexistentes no frontend.

### Qualidade

- Teste financeiro cobre aporte, restart, contrato aprovado, pagamento, bloqueio de exclusao com pagamento, transacao avulsa, reset, restore, score, blacklist e usuarios administrativos.
- `npm audit` validado com 0 vulnerabilidades.
- `npm run qa` validado com nota 100/100.
- `node --check` e `npm run lint` validados antes do empacotamento.

## [5.0.4] - 2026-04-24

### Adicionado

- Observacao livre no contrato, salva em `emprestimos.obs`.

## [5.0.3] - 2026-04-24

### Corrigido

- Contratos aprovados mostram pendentes e impressos.
- Limpeza de artefatos residuais de build.

## [5.0.2] - 2026-04-23

### Adicionado

- Tipos de credito configuraveis em Configuracoes.
- Coluna `limites_tipos` em `clientes` para limites extras.

## [5.0.1] - 2026-04-23

### Corrigido

- Rate limiter nao bloqueia loopback.
- Login/register retornam mensagens especificas.
- Arquivo de aprovados persiste antes de disparar impressao.
- Frontend autodetecta porta do backend local.

## [5.0.0] - 2026-04-18

### Release

- Consolidacao Windows desktop.
- Backend Express embarcado.
- SQLite local como fonte de verdade.
- Instalador Inno Setup com verificacao de Windows x64.
