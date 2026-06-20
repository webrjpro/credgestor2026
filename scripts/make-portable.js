/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CredGestor — Gerador de Pacote Portátil                            ║
 * ║                                                                     ║
 * ║  USO: Execute este script na máquina que TEM o Node.js instalado.   ║
 * ║  Gera uma pasta portátil que o usuário executa sem instalar nada.   ║
 * ║                                                                     ║
 * ║  INSTRUÇÃO: node scripts/make-portable.js                           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const OUT_DIR = path.join(ROOT, 'dist-portable', 'CredGestor');
const DIST_ZIP = path.join(ROOT, 'dist-portable', 'CredGestor-Portatil.zip');

// ── Pastas e arquivos a copiar para o pacote portátil ──
const ITEMS_TO_COPY = [
  // Core do app
  { src: 'index.html',       dst: 'index.html' },
  { src: 'main.js',          dst: 'main.js' },
  { src: 'main',             dst: 'main', isDir: true },
  { src: 'offline-services.js', dst: 'offline-services.js' },
  { src: 'preload.js',       dst: 'preload.js' },
  { src: 'package.json',     dst: 'package.json' },
  // Modo offline: .env nao e copiado. JWT_SECRET e gerado em runtime.

  // Frontend
  { src: 'js',               dst: 'js',      isDir: true },
  { src: 'assets',           dst: 'assets',  isDir: true },
  { src: 'dist-renderer',    dst: 'dist-renderer', isDir: true },

  // Backend API (Node.js REST — sem .env, sem data/)
  { src: 'backend',          dst: 'backend', isDir: true },

  // Node.js embarcado (para rodar o backend sem precisar do Node instalado)
  { src: '.tools/node-v22.22.2-win-x64', dst: 'node-runtime/win-x64', isDir: true },

  // node_modules do app principal (Electron etc.)
  { src: 'node_modules',     dst: 'node_modules', isDir: true },
];


// Pastas a excluir dentro de node_modules copiadas (economiza espaço)
const EXCLUDE_IN_NODE_MODULES = [
  '.bin', '.cache', '.yarn',
];

function log(msg) {
  console.log('[PORTABLE]', msg);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyItem(src, dst, isDir) {
  if (!fs.existsSync(src)) {
    log(`  AVISO: ${src} não encontrado — pulando`);
    return;
  }

  if (isDir) {
    copyDirRecursive(src, dst);
  } else {
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
  }
}

// Nomes de arquivos/pastas que NUNCA devem ir para o pacote portátil
const ALWAYS_EXCLUDE = new Set([
  '.env',
  '.env.local',
  '.env.production',
  'node_modules',        // cada módulo copia os seus próprios se necessário
  'uploads',
  'data',                // banco de dados do backend (runtime)
  '.git',
]);

function copyDirRecursive(src, dst) {
  ensureDir(dst);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (ALWAYS_EXCLUDE.has(entry.name)) {
      log(`  [skip] ${path.relative(ROOT, path.join(src, entry.name))}`);
      continue;
    }
    if (entry.isSymbolicLink()) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function cleanOldBuild() {
  if (fs.existsSync(OUT_DIR)) {
    log('Removendo build anterior...');
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  ensureDir(OUT_DIR);
  ensureDir(path.dirname(DIST_ZIP));
}

function createLauncher() {
  // Script .bat para iniciar o app
  const batContent = `@echo off
title CredGestor
cd /d "%~dp0"
echo Iniciando CredGestor...
start "" "%~dp0node_modules\\.bin\\electron.cmd" "%~dp0" --no-sandbox
`;
  fs.writeFileSync(path.join(OUT_DIR, 'CredGestor.bat'), batContent, 'utf8');

  // Tenta encontrar electron.exe dentro de node_modules
  const electronExePath = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (fs.existsSync(electronExePath)) {
    log('Copiando electron.exe para o pacote...');
    const electronDistSrc = path.join(ROOT, 'node_modules', 'electron', 'dist');
    const electronDistDst = path.join(OUT_DIR, 'electron-dist');
    copyDirRecursive(electronDistSrc, electronDistDst);

    // Criar launcher direto para electron.exe
    const directLaunch = `@echo off
title CredGestor
cd /d "%~dp0"
echo Iniciando CredGestor...
start "" "%~dp0electron-dist\\electron.exe" "%~dp0" --no-sandbox
`;
    fs.writeFileSync(path.join(OUT_DIR, 'CredGestor.bat'), directLaunch, 'utf8');
    log('Launcher direto criado (electron-dist/electron.exe)');
  } else {
    log('AVISO: electron.exe não encontrado em node_modules/electron/dist — usando launcher via .cmd');
  }
}

function createReadme() {
  const readme = `# CredGestor — Pacote Portátil

## Como usar

1. Extraia esta pasta em qualquer local do computador
2. Clique duas vezes em **CredGestor.bat** para iniciar
3. O sistema abrirá automaticamente

## Observações

- Não precisa instalar nada
- Os dados ficam em: C:\\Users\\[seu_usuario]\\AppData\\Roaming\\CredGestor
- Backups automaticos em: C:\\Users\\[seu_usuario]\\AppData\\Roaming\\CredGestor\\backups

## Suporte

CredGestor v${VERSION}
Copyright Carlos Antonio de Oliveira Piquet
`;
  fs.writeFileSync(path.join(OUT_DIR, 'LEIA-ME.txt'), readme, 'utf8');
}

async function main() {
  log('=== CredGestor — Gerador de Pacote Portátil ===');
  log(`Destino: ${OUT_DIR}`);

  cleanOldBuild();

  log('\nCopiando arquivos...');
  for (const item of ITEMS_TO_COPY) {
    const src = path.join(ROOT, item.src);
    const dst = path.join(OUT_DIR, item.dst);
    log(`  ${item.src} → ${item.dst}`);
    copyItem(src, dst, item.isDir);
  }

  log('\nInstalando dependências do backend...');
  const backendNodeModulesDst = path.join(OUT_DIR, 'backend', 'node_modules');
  if (!fs.existsSync(backendNodeModulesDst)) {
    try {
      // Tenta copiar node_modules do backend se existir
      const backendNodeModulesSrc = path.join(ROOT, 'backend', 'node_modules');
      if (fs.existsSync(backendNodeModulesSrc)) {
        log('  Copiando backend/node_modules...');
        copyDirRecursive(backendNodeModulesSrc, backendNodeModulesDst);
      } else {
        log('  AVISO: backend/node_modules não encontrado - instale manualmente com: cd backend && npm install');
      }
    } catch (e) {
      log('  AVISO: Falha ao copiar backend/node_modules: ' + e.message);
    }
  }

  log('\nCriando launcher...');
  createLauncher();

  log('Criando README...');
  createReadme();

  log('\n✅ Pacote portátil criado com sucesso!');
  log(`📁 Pasta: ${OUT_DIR}`);
  log('\nComo distribuir:');
  log('  1. Comprima a pasta "CredGestor" em ZIP');
  log('  2. Envie ao usuário final');
  log('  3. Usuário extrai e executa "CredGestor.bat"');
}

main().catch(err => {
  console.error('[ERRO]', err.message);
  process.exit(1);
});
