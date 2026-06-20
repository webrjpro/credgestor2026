# Guia de Build - Maquina Nova

Este guia gera uma build limpa do CredGestor 6.0.2 para Windows x64.

Ultima revisao: 2026-06-20

## Pre-requisitos

1. Windows 10/11 x64.
2. Node.js 20 ou 22 para compilar.
3. Inno Setup 6 para gerar instalador Inno.

Verifique:

```bash
node --version
npm --version
```

## Instalar Dependencias

Na raiz do projeto:

```bash
npm install
npm install --workspace backend
```

Dependencias principais:

- Raiz: Electron, electron-builder, esbuild, Tailwind e bibliotecas do renderer.
- `backend/`: Express, SQLite nativo, autenticacao e middlewares REST.

Nao existe instalacao de Portal Web, Supabase, Cloudflare R2 ou servico externo de mensagens.

## Atualizar Versao

Para mudar a versao:

```bash
npm version 6.0.2 --no-git-tag-version
npm run version:sync
```

Exemplo para a proxima versao:

```bash
npm version 6.0.3 --no-git-tag-version
npm run version:sync
```

O script sincroniza:

- `index.html`
- `installer/CredGestor-InnoSetup.iss`
- `CHANGELOG.md`
- `package-lock.json`

## Build Limpo

Antes de empacotar, remova saidas residuais:

```powershell
Remove-Item -Recurse -Force dist, dist-renderer, dist-portable -ErrorAction SilentlyContinue
```

Pastas locais de banco/reparo tambem podem ser removidas antes de release:

```powershell
Remove-Item -Recurse -Force scratch, backend\data -ErrorAction SilentlyContinue
```

O backend recria `backend/data` quando necessario em desenvolvimento.

## Validar Antes Do Build

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

## Gerar Instalador Oficial

```bash
npm run pack:inno
```

Resultado esperado:

```text
dist/CredGestor-InnoSetup-6.0.2.exe
```

Tambem sera criada a pasta intermediaria:

```text
dist/win-unpacked/
```

Estrutura minima esperada:

```text
dist/win-unpacked/
  CredGestor.exe
  resources/
    app.asar
    backend/
      node_modules/
    node-runtime/win-x64/node.exe
```

O script de build copia dependencias runtime do backend para `resources/backend/node_modules`. Isso e obrigatorio para o app instalado iniciar o servidor local sozinho.

## Gerar Apenas Pasta Executavel

```bash
npm run pack:prepare
```

## Rodar Localmente Pelo Terminal

Use:

```bash
npm start
```

O script chama `scripts/start-electron.js`, que limpa `ELECTRON_RUN_AS_NODE` antes de abrir o Electron. Isso evita erro de inicializacao quando o ambiente foi herdado de scripts de build.

Depois de abrir, valide o backend local:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:4000/health/ready' -TimeoutSec 5
```

Resposta esperada:

```text
status: ready
databaseOk: true
```

## Conferencia De Release

Antes de entregar, confirme que nao ha artefatos residuais:

```powershell
$patterns = @(
  ('Credi' + 'Gestor'),
  ('T' + 'KI'),
  ('Enterprise' + ' X'),
  ('5' + '\.5\.0'),
  ('sistema_fin' + '_v3')
) -join '|'
rg -n $patterns -S -g "!node_modules/**" -g "!backend/node_modules/**" -g "!dist/**" -g "!dist-renderer/**" -g "!package-lock.json" -g "!backend/package-lock.json"
```

No `dist/`, o instalador esperado deve ser:

```text
CredGestor-InnoSetup-6.0.2.exe
```

## Gerar Instalador Com Auto-Update

Para clientes que devem receber atualizacao automaticamente, gere o instalador NSIS:

```bash
npm run build:release
```

Resultado esperado:

```text
dist/CredGestor-Setup-6.0.2.exe
dist/CredGestor-Setup-6.0.2.exe.blockmap
dist/latest.yml
```

Esses tres arquivos precisam estar na mesma GitHub Release para o app instalado detectar, baixar e instalar a nova versao.

## Publicar Release Remota No GitHub

Depois de alterar a versao e commitar:

```bash
git tag v6.0.2
git push origin main --tags
```

O workflow `.github/workflows/release.yml` roda no GitHub, baixa o Node runtime embarcado, gera o instalador NSIS e publica os artefatos na Release.

Observacao importante: o auto-update funciona a partir do instalador NSIS (`CredGestor-Setup-*`). Instalacoes antigas feitas pelo Inno podem precisar receber essa versao uma vez manualmente; depois disso as proximas atualizacoes passam a chegar pelo app.

Tambem confirme que o app instalado nao fica parado em "Iniciando o servidor local". Se isso ocorrer, verifique se existem estas pastas no pacote:

```text
dist/win-unpacked/resources/backend/node_modules/express
dist/win-unpacked/resources/backend/node_modules/dotenv
dist/win-unpacked/resources/backend/node_modules/better-sqlite3
```

## Documentacao Antes Da Entrega

Atualize estes arquivos quando houver mudanca de interface, build ou fluxo do usuario:

- `CHANGELOG.md`
- `DOCUMENTACAO.md`
- `MANUAL_DO_USUARIO.md`
- `INSTRUCOES_NOVA_MAQUINA.md`

O `LICENSE` deve ser apenas conferido. Nao altere os termos juridicos sem decisao expressa do titular.

## Inno Setup Nao Encontrado

Instale o Inno Setup 6 ou defina a variavel `ISCC`.

Caminhos padrao suportados:

```text
C:\Program Files (x86)\Inno Setup 6\ISCC.exe
C:\Program Files\Inno Setup 6\ISCC.exe
```

## Observacoes

- `.tools/node-v22.22.2-win-x64` e usado pelo instalador final; nao apague.
- `src/` e entrada do build do renderer; nao apague.
- `backend/data/` e dado local de desenvolvimento; nao entra no instalador.
- `scratch/` e area de reparo temporario; nao entra no instalador.
