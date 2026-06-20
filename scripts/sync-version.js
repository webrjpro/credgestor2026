/**
 * sync-version.js — Sincronizador de versão do CredGestor
 * =====================================================================
 * Lê a versão do package.json e atualiza TODOS os arquivos que a referenciam.
 * 
 * Uso:  node scripts/sync-version.js
 *       npm run version:sync
 * 
 * Arquivos sincronizados:
 *   1. index.html              → "CredGestor v{VERSION}"
 *   2. installer/*.iss         → #define MyAppVersion "{VERSION}"
 *   3. CHANGELOG.md            → cabeçalho (se existir)
 * 
 * IMPORTANTE: Sempre execute este script ANTES de gerar o instalador!
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

console.log(`\n🔄 Sincronizando versão → v${VERSION}\n`);

let updated = 0;
let errors = 0;

// ── Helper ────────────────────────────────────────────────────────────────────
function syncFile(relPath, pattern, replacement, label) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.log(`   ⏭  ${relPath} — não encontrado (ignorado)`);
    return;
  }
  const original = fs.readFileSync(abs, 'utf8');
  const result = original.replace(pattern, replacement);
  if (result !== original) {
    fs.writeFileSync(abs, result, 'utf8');
    console.log(`   ✅ ${relPath} — ${label}`);
    updated++;
  } else {
    console.log(`   ✔  ${relPath} — já está em v${VERSION}`);
  }
}

// ── 1. index.html — "CredGestor vX.Y.Z" ─────────────────────────────────────
try {
  syncFile(
    'index.html',
    /CredGestor v\d+\.\d+\.\d+/g,
    `CredGestor v${VERSION}`,
    'versão na UI atualizada'
  );
} catch (e) {
  console.error(`   ❌ index.html — ${e.message}`);
  errors++;
}

// ── 2. installer/CredGestor-InnoSetup.iss — #define MyAppVersion ────────────
try {
  syncFile(
    'installer/CredGestor-InnoSetup.iss',
    /#define MyAppVersion\s+"[\d.]+"/g,
    `#define MyAppVersion   "${VERSION}"`,
    'InnoSetup version atualizada'
  );
} catch (e) {
  console.error(`   ❌ installer/CredGestor-InnoSetup.iss — ${e.message}`);
  errors++;
}

// ── 3. CHANGELOG.md (cabeçalho) ─────────────────────────────────────────────
try {
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    syncFile(
      'CHANGELOG.md',
      /## \[\d+\.\d+\.\d+\]/,
      `## [${VERSION}]`,
      'cabeçalho do CHANGELOG atualizado'
    );
  }
} catch (e) {
  console.error(`   ❌ CHANGELOG.md — ${e.message}`);
  errors++;
}

// ── 4. package-lock.json (top-level) ────────────────────────────────────────
try {
  const lockPath = path.join(ROOT, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const oldVer = lock.version;
    if (lock.version !== VERSION) {
      lock.version = VERSION;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = VERSION;
      }
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
      console.log(`   ✅ package-lock.json — ${oldVer} → ${VERSION}`);
      updated++;
    } else {
      console.log(`   ✔  package-lock.json — já está em v${VERSION}`);
    }
  }
} catch (e) {
  console.error(`   ❌ package-lock.json — ${e.message}`);
  errors++;
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
if (errors > 0) {
  console.log(`⚠  Concluído com ${errors} erro(s). ${updated} arquivo(s) atualizado(s).`);
  process.exit(1);
} else {
  console.log(`✅ Todos os arquivos sincronizados para v${VERSION} (${updated} alterado(s)).`);
}
console.log(`${'═'.repeat(50)}\n`);
