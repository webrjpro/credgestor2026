# Documentacao Tecnica e Arquitetural - CredGestor

**Versao:** 6.0.1
**Plataforma:** Windows x64  
**Licenca:** Proprietaria  
**Status:** Release offline local com atualizacao remota por GitHub Releases
**Stack:** Electron 41, Node.js embarcado, Express local, SQLite via better-sqlite3
**Ultima revisao:** 2026-06-20

## 1. Visao Geral

O CredGestor e um sistema desktop offline para gestao de credito. A aplicacao roda em Electron, inicia um backend Express local restrito a `127.0.0.1` e persiste dados em SQLite no disco do usuario.

Nao ha Portal Web, Supabase, Cloudflare R2, microservico externo de mensagens ou dependencia de nuvem para operacao diaria.

Na inicializacao, o processo principal aguarda o backend local sinalizar prontidao antes de exibir a janela. Chamadas IPC criticas tambem possuem retry curto para evitar falhas de primeira abertura.

No app instalado, o backend embarcado precisa conter suas dependencias runtime dentro de `resources/backend/node_modules`. O build oficial cuida dessa copia automaticamente.

## 2. Fluxo de Comunicacao

```text
------------------+      IPC seguro       +------------------+
| Renderer         | --------------------> | main.js          |
| HTML/CSS/JS      |                       | Gateway Electron |
+------------------+                       +------------------+
          ^                                           |
          | contextBridge                             | HTTP loopback + X-System-Key
          |                                           v
+------------------+                       +------------------+
| preload.js       |                       | Backend Express  |
| API window.db    |                       | 127.0.0.1        |
+------------------+                       +------------------+
                                                      |
                                                      v
                                           +------------------+
                                           | SQLite local     |
                                           | WAL mode         |
                                           +------------------+
```

## 3. Responsabilidades Por Camada

### Renderer

- Renderiza telas, modais, tabelas e graficos.
- Coleta comandos do usuario.
- Mantem estado em memoria apenas como cache de UI.
- Nao deve ser fonte de verdade para dinheiro, score, blacklist ou status financeiro.
- Nao faz chamadas HTTP diretas para o backend nas rotinas operacionais; usa `window.db`.

Arquivos principais:

- `index.html`
- `js/core.js`
- `js/engine.js`
- `js/components/modals.js`
- `js/features/auth.js`
- `js/features/ui-system.js`
- `js/features/crm-cobranca.js`
- `js/features/relatorios.js`
- `js/features/auto-update.js`
- `js/features/workflow.js`
- `js/features/product-ux.js`
- `js/intelligence.js`
- `js/semi-autonomy.js`
- `js/views/dashboard.view.js`
- `js/views/clientes.view.js`
- `js/views/emprestimos.view.js`
- `js/views/filtradas.view.js`
- `js/views/pagamentos.view.js`
- `js/views/extratos.view.js`
- `js/views/admin.view.js`

### Preload

`preload.js` expoe uma API limitada via `contextBridge`. Inputs sao sanitizados antes de chegar ao processo principal.

### Processo Principal

`main.js` cria a janela, aplica politicas de seguranca, encaminha chamadas IPC para o backend local e controla o auto-update via GitHub Releases quando o app esta empacotado.

`main/backend-process.js` inicia e encerra o backend embarcado com Node.js local.

### Backend

O backend e a fonte de verdade para regras criticas:

- Caixa e ledger financeiro: `backend/src/services/caixa.service.js`
- Score e blacklist: `backend/src/services/clientes.service.js`
- Rotas REST: `backend/src/routes/`
- Banco e migracoes: `backend/src/database.js`
- Usuarios administrativos: `backend/src/routes/tenants.routes.js`

## 4. Regras Financeiras Criticas

### Caixa

Toda entrada ou saida de caixa passa por `caixa.service.js`. O saldo nao deve ser alterado diretamente no renderer.

Operacoes cobertas:

- Aporte manual.
- Criacao/aprovacao de emprestimo.
- Ajuste de aprovacao.
- Pagamento de parcela.
- Exclusao de contrato/transacao com estorno.
- Reset total.
- Gestao de usuarios administrativos.

### Pagamento

O pagamento de emprestimo e atomico:

1. Cria transacao financeira.
2. Atualiza ledger de caixa.
3. Atualiza parcelas/status do emprestimo.
4. Atualiza score e blacklist do cliente quando recebe `scoreEventos`.

Se qualquer etapa falhar, nada deve ser persistido parcialmente.

### Score e Blacklist

Score e blacklist ficam no backend em `clientes.service.js`.

Regras atuais:

- Pagamento com multa: reduz 50 pontos e zera pagamentos em dia.
- Score menor ou igual a zero: cliente entra automaticamente na Lista de Bloqueados.
- Pagamento em dia: soma um evento positivo.
- A cada 10 pagamentos em dia: recupera 30 pontos e zera o ciclo.
- Bloqueio/desbloqueio manual usa `PUT /api/clientes/:id/blacklist`.

## 5. Banco de Dados

Banco local padrao:

```text
%APPDATA%\CredGestor\credgestor-api.db
```

Tabelas principais:

- `clientes`
- `emprestimos`
- `transacoes`
- `caixa`
- `caixa_historico`
- `arquivo_aprovados`
- `recibos_entrega`
- `config`
- `auth`
- `audit_log`
- `tenants`

O backend recria diretorios de dados quando necessario. A pasta `backend/data/` nao deve ser versionada nem distribuida.

## 6. Usuarios E Acesso

O primeiro usuario cadastrado vira administrador. A tela **Gerenciar Usuarios** permite criar, listar e remover usuarios do banco local.

Regras:

- Apenas contas `admin` ou `superadmin` acessam a gestao de usuarios.
- Usuarios comuns nao mantem `adminToken` no renderer.
- A criacao/remocao de usuarios passa por IPC e backend local.

## 7. Build e Distribuicao

Comandos principais:

```bash
npm run version:sync
npm run lint
npm --workspace backend test
npm run qa
npm run pack:inno
npm run build:release
```

Artefatos oficiais da versao 6.0.1:

```text
dist/CredGestor-InnoSetup-6.0.1.exe
dist/CredGestor-Setup-6.0.1.exe
dist/CredGestor-Setup-6.0.1.exe.blockmap
dist/latest.yml
```

O Inno Setup continua sendo o instalador manual tradicional. O instalador NSIS (`CredGestor-Setup-*.exe`) e o canal recomendado para clientes que devem receber atualizacoes automaticamente.

O instalador inclui:

- `CredGestor.exe`
- `resources/app.asar`
- `resources/backend/`
- `resources/backend/node_modules/`
- `resources/node-runtime/win-x64/node.exe`

O instalador nao deve incluir:

- `.env`
- `backend/data/`
- `scratch/`
- Bancos locais de desenvolvimento.
- Backups de reparo.
- Artefatos residuais de nomes anteriores do produto.

## 7.1 Atualizacao Remota

O auto-update usa:

- `electron-updater` no processo principal.
- `preload.js` expondo `window.electronAPI.updates`.
- `js/features/auto-update.js` mostrando progresso e acao de reinicio.
- GitHub Releases no repositorio `webrjpro/credgestor2026`.

Fluxo:

```text
git tag v6.0.1
git push origin main --tags
GitHub Actions gera NSIS + latest.yml
GitHub Release recebe os artefatos
App instalado verifica update ao abrir
App baixa a versao nova
Usuario reinicia para instalar
```

Para o auto-update funcionar, a release precisa conter:

```text
CredGestor-Setup-{version}.exe
CredGestor-Setup-{version}.exe.blockmap
latest.yml
```

Clientes instalados por Inno podem precisar instalar uma vez o NSIS update-ready. Depois disso, as proximas versoes passam a ser entregues pelo proprio app.

## 8. Validacoes De Release

Antes de entregar:

```bash
npm audit
npm run lint
npm --workspace backend test
npm run qa
```

Resultado esperado:

- `npm audit`: 0 vulnerabilidades.
- `npm run qa`: 100/100.
- Testes backend: pass.
- Instalador Inno gerado com nome `CredGestor-InnoSetup-6.0.1.exe`.
- Instalador NSIS/update gerado com nome `CredGestor-Setup-6.0.1.exe`.

Para validar rapidamente a execucao local apos mudancas de interface:

```bash
npm run build:renderer
npm start
```

O backend local deve responder em:

```text
http://127.0.0.1:4000/health/ready
```

Resposta esperada:

```json
{
  "status": "ready",
  "mode": "embedded",
  "databaseOk": true
}
```

## 9. Politica De Limpeza

Pode remover com seguranca quando forem residuos locais:

- `scratch/`
- `backend/data/`
- `dist/` antes de rebuild.
- `dist-renderer/` antes de rebuild.
- `dist-portable/` quando nao for entregar portable.

Nao remover sem revisar uso no build:

- `.tools/`
- `src/`
- `scripts/`
- `installer/`
- `assets/`
- `backend/`
- `js/`
- `main/`

## 10. Camada Visual E UX

A camada `js/features/product-ux.js` concentra melhorias de experiencia sem alterar regra de negocio interna.

Recursos desta camada:

- Central de Operacoes.
- Esteira Visual de Contratos.
- Central de Recibos.
- Busca Global (`Ctrl+K`).
- Timeline do Cliente.

Essas telas usam dados ja existentes em `state`, `window.db` e funcoes de dominio ja carregadas no renderer. A camada nao deve assumir responsabilidade por caixa, score, pagamentos, blacklist ou persistencia transacional.

## 11. Rotas SPA Visuais

Rotas principais no `router(view)`:

- `operacoes`: Central de Operacoes.
- `dashboard`: Dashboard Financeiro.
- `clientes`: Gestao de Clientes.
- `extratos`: Extratos & Caixa.
- `em_aberto`, `inadimplentes`, `finalizados`: carteira.
- `esteira`: Esteira de Contratos.
- `aprovados`, `em_analise`, `reprovados`, `arquivo_aprovados`: aprovacao.
- `recibos`: Central de Recibos.
- `projecao`, `metas`, `auditoria`: inteligencia.
- `admin_usuarios`: administracao local.

## 12. Cuidados De Interface

- Evitar tabelas que escondem acoes apenas no final de rolagem horizontal.
- Valores financeiros devem usar `white-space: nowrap`, `overflow: hidden` e `text-overflow: ellipsis` quando estiverem dentro de cards compactos.
- Modais de confirmacao critica devem usar `<dialog>` ou camada acima do modal atual para evitar falsa impressao de botao quebrado.
- Novas telas devem usar botoes com icones, cards compactos e a mesma hierarquia visual do app desktop.
