/**
 * Build script do renderer sem depender de `npm/npx` no PATH.
 * Usa o runtime Node do processo atual (Electron em modo node) para
 * executar os CLIs locais de esbuild e tailwindcss.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-renderer');
const NODE_BIN = process.execPath;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
}

function runNodeCli(scriptPath, args) {
  execFileSync(NODE_BIN, [scriptPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1'
    }
  });
}

function kb(filePath) {
  return (fs.statSync(filePath).size / 1024).toFixed(1);
}

function main() {
  ensureDir(DIST);

  console.log('==============================================');
  console.log('CredGestor - Build Renderer');
  console.log('==============================================');

  const esbuildCli = path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild');
  const vendorOut = path.join(DIST, 'vendor.bundle.js');
  const vendorMap = path.join(DIST, 'vendor.bundle.js.map');
  const cssOut = path.join(DIST, 'styles.bundle.css');

  removeFileIfExists(vendorOut);
  removeFileIfExists(vendorMap);
  removeFileIfExists(cssOut);

  console.log('[1/2] Bundling vendor.js with esbuild...');
  runNodeCli(esbuildCli, [
    path.join(ROOT, 'src', 'vendor.js'),
    '--bundle',
    '--format=iife',
    '--platform=browser',
    '--target=chrome110',
    `--outfile=${vendorOut}`,
    '--minify',
    '--legal-comments=none'
  ]);
  console.log(`OK vendor.bundle.js (${kb(vendorOut)} KB)`);

  const tailwindCli = path.join(ROOT, 'node_modules', 'tailwindcss', 'lib', 'cli.js');

  console.log('[2/2] Building styles.bundle.css with tailwindcss...');
  runNodeCli(tailwindCli, [
    '-i',
    path.join(ROOT, 'src', 'styles.css'),
    '-o',
    cssOut,
    '--minify'
  ]);
  console.log(`OK styles.bundle.css (${kb(cssOut)} KB)`);

  console.log('Build completed: dist-renderer/');
}

try {
  main();
} catch (err) {
  console.error('[build-renderer] failed:', err && err.message ? err.message : err);
  process.exit(1);
}
