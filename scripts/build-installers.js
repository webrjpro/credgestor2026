/**
 * CredGestor - build oficial de distribuicao.
 *
 * Alvos:
 *   --target=dir   prepara dist/win-unpacked
 *   --target=inno  prepara dist/win-unpacked e compila o instalador Inno
 *   --target=nsis  prepara dist/win-unpacked e compila NSIS
 *   --target=all   compila Inno e NSIS
 *
 * O alvo padrao e Inno. NSIS fica isolado para nao quebrar o pipeline oficial.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const rootPackagePath = path.join(ROOT, 'package.json');
const pkg = require(rootPackagePath);
const distDir = path.join(ROOT, 'dist');
const unpackedDir = path.join(distDir, 'win-unpacked');
const resourcesDir = path.join(unpackedDir, 'resources');
const installerDir = path.join(ROOT, 'installer');
const innoScript = path.join(installerDir, 'CredGestor-InnoSetup.iss');
const innoOutput = path.join(distDir, `CredGestor-InnoSetup-${pkg.version}.exe`);

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const runLogPath = path.join(distDir, 'build-run.log');
fs.writeFileSync(runLogPath, `[${new Date().toISOString()}] build-start official-inno\n`, 'utf8');

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(runLogPath, `${line}\n`, 'utf8');
}

function relative(filePath) {
  return path.relative(ROOT, filePath) || '.';
}

function assertInsideRoot(targetPath) {
  const resolvedRoot = `${path.resolve(ROOT)}${path.sep}`;
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== path.resolve(ROOT) && !resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error(`Recusa de operacao fora do workspace: ${resolvedTarget}`);
  }
}

function removePathIfExists(targetPath, label) {
  assertInsideRoot(targetPath);
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
  log(`cleanup: removido ${label || relative(targetPath)}`);
}

async function withRootPackageRestore(label, operation) {
  const originalPackage = fs.readFileSync(rootPackagePath, 'utf8');
  try {
    return await operation();
  } finally {
    if (fs.existsSync(rootPackagePath)) {
      const currentPackage = fs.readFileSync(rootPackagePath, 'utf8');
      if (currentPackage !== originalPackage) {
        fs.writeFileSync(rootPackagePath, originalPackage, 'utf8');
        log(`proteção: package.json restaurado após ${label}`);
      }
    }
  }
}

function cleanupNsisArtifacts() {
  if (!fs.existsSync(distDir)) return;
  for (const entry of fs.readdirSync(distDir)) {
    const lower = entry.toLowerCase();
    const isNsisPartial = lower.endsWith('.nsis.7z');
    const isNsisInstaller = /^credgestor-setup-.*\.(exe|blockmap)$/i.test(entry);
    const isUpdateMetadata = /^latest.*\.ya?ml$/i.test(entry);
    if (isNsisPartial || isNsisInstaller || isUpdateMetadata) {
      removePathIfExists(path.join(distDir, entry), `artefato NSIS residual/parcial ${entry}`);
    }
  }
}

function cleanupDistTempArtifacts() {
  if (!fs.existsSync(distDir)) return;
  for (const entry of fs.readdirSync(distDir)) {
    const isQaTemp = /^qa-db-copy-\d+\.sqlite(?:-(?:shm|wal))?$/i.test(entry);
    const isStaleBuildProbe = /^fresh-build\.(?:log|pid)$/i.test(entry);
    if (isQaTemp || isStaleBuildProbe) {
      removePathIfExists(path.join(distDir, entry), `artefato temporario ${entry}`);
    }
  }
}

function buildRendererAssets() {
  const rendererScript = path.join(ROOT, 'scripts', 'build-renderer.js');
  if (!fs.existsSync(rendererScript)) {
    throw new Error(`Script de build do renderer nao encontrado: ${rendererScript}`);
  }

  log('PASSO 0: gerando bundle do renderer...');
  const result = spawnSync(process.execPath, [rendererScript], {
    cwd: ROOT,
    windowsHide: true,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const err = `build-renderer falhou (exit ${result.status})\n${result.stdout || ''}\n${result.stderr || ''}`;
    log(err);
    throw new Error(err);
  }

  const required = [
    path.join(ROOT, 'dist-renderer', 'vendor.bundle.js'),
    path.join(ROOT, 'dist-renderer', 'styles.bundle.css'),
  ];
  for (const file of required) {
    if (!fs.existsSync(file)) {
      throw new Error(`Arquivo obrigatorio do renderer nao gerado: ${relative(file)}`);
    }
  }
  log('PASSO 0 OK - renderer pronto');
}

function robocopy(src, dst, excludeDirs = [], excludeFiles = []) {
  if (!fs.existsSync(src)) {
    log(`AVISO: fonte nao existe: ${relative(src)}`);
    return;
  }
  assertInsideRoot(dst);
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });

  const args = [
    src,
    dst,
    '*.*',
    '/E',
    '/SL',
    '/XJ',
    '/R:2',
    '/W:1',
    '/NP',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
  ];

  if (excludeDirs.length > 0) {
    args.push('/XD');
    args.push(...excludeDirs);
  }
  if (excludeFiles.length > 0) {
    args.push('/XF');
    args.push(...excludeFiles);
  }

  log(`robocopy: ${relative(src)} -> ${relative(dst)}`);
  const result = spawnSync('robocopy', args, { windowsHide: true, encoding: 'utf8' });
  if (result.status !== null && result.status >= 8) {
    const err = `robocopy falhou (exit ${result.status}) copiando ${relative(src)}\n${result.stdout || ''}\n${result.stderr || ''}`;
    log(err);
    throw new Error(err);
  }
  log(`  -> OK (exit code ${result.status})`);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function packageNameToPath(packageName) {
  return path.join(...packageName.split('/'));
}

function findInstalledPackageDir(fromDir, packageName) {
  let current = path.resolve(fromDir);
  const rootParent = path.dirname(ROOT);

  while (current && current.startsWith(rootParent)) {
    const candidate = path.join(current, 'node_modules', packageNameToPath(packageName));
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;

    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }

  return null;
}

function getPackageDependencies(packageDir) {
  const packageJson = readJsonFile(path.join(packageDir, 'package.json'));
  return {
    name: packageJson.name,
    dependencies: Object.keys(packageJson.dependencies || {}),
    optionalDependencies: Object.keys(packageJson.optionalDependencies || {}),
  };
}

function collectBackendRuntimePackages() {
  const backendPackagePath = path.join(ROOT, 'backend', 'package.json');
  const backendPackage = readJsonFile(backendPackagePath);
  const initialDependencies = Object.keys(backendPackage.dependencies || {});
  const queue = initialDependencies.map(name => ({
    name,
    fromDir: path.join(ROOT, 'backend'),
    optional: false,
  }));
  const collected = new Map();

  while (queue.length > 0) {
    const item = queue.shift();
    const packageDir = findInstalledPackageDir(item.fromDir, item.name);

    if (!packageDir) {
      if (item.optional) {
        log(`  [skip optional] dependencia opcional ausente: ${item.name}`);
        continue;
      }
      throw new Error(`Dependencia do backend nao instalada: ${item.name}. Execute npm install antes do build.`);
    }

    const packageKey = path.resolve(packageDir).toLowerCase();
    if (collected.has(packageKey)) continue;

    const meta = getPackageDependencies(packageDir);
    collected.set(packageKey, {
      name: meta.name || item.name,
      packageDir,
    });

    for (const dependencyName of meta.dependencies) {
      queue.push({ name: dependencyName, fromDir: packageDir, optional: false });
    }
    for (const dependencyName of meta.optionalDependencies) {
      queue.push({ name: dependencyName, fromDir: packageDir, optional: true });
    }
  }

  return Array.from(collected.values())
    .sort((a, b) => a.packageDir.localeCompare(b.packageDir));
}

function copyDirectoryRecursive(src, dst) {
  assertInsideRoot(dst);
  fs.cpSync(src, dst, {
    recursive: true,
    dereference: false,
    force: true,
    errorOnExist: false,
  });
}

function copyBackendRuntimeDependencies() {
  const targetNodeModules = path.join(resourcesDir, 'backend', 'node_modules');
  removePathIfExists(targetNodeModules, 'backend/node_modules empacotado residual');
  fs.mkdirSync(targetNodeModules, { recursive: true });

  const packages = collectBackendRuntimePackages();
  log(`copiando dependencias runtime do backend (${packages.length} pacotes)...`);

  for (const pkgInfo of packages) {
    const relativeToRootModules = path.relative(path.join(ROOT, 'node_modules'), pkgInfo.packageDir);
    if (relativeToRootModules.startsWith('..')) {
      throw new Error(`Dependencia fora de node_modules raiz: ${pkgInfo.packageDir}`);
    }

    const destination = path.join(targetNodeModules, relativeToRootModules);
    copyDirectoryRecursive(pkgInfo.packageDir, destination);
  }
}

function getMissingUnpackedFiles() {
  const required = [
    path.join(unpackedDir, 'CredGestor.exe'),
    path.join(unpackedDir, 'resources.pak'),
    path.join(unpackedDir, 'snapshot_blob.bin'),
    path.join(unpackedDir, 'v8_context_snapshot.bin'),
    path.join(unpackedDir, 'locales', 'pt-BR.pak'),
    path.join(resourcesDir, 'app.asar'),
  ];
  return required.filter(file => !fs.existsSync(file));
}

function getMissingDistributionFiles() {
  const required = [
    path.join(resourcesDir, 'backend', 'server.js'),
    path.join(resourcesDir, 'backend', 'node_modules', 'express', 'package.json'),
    path.join(resourcesDir, 'backend', 'node_modules', 'dotenv', 'package.json'),
    path.join(resourcesDir, 'backend', 'node_modules', 'better-sqlite3', 'package.json'),
    path.join(resourcesDir, 'backend', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    path.join(resourcesDir, 'node-runtime', 'win-x64', 'node.exe'),
  ];
  return [...getMissingUnpackedFiles(), ...required.filter(file => !fs.existsSync(file))];
}

async function buildWinUnpacked() {
  log('PASSO 1: gerando win-unpacked limpo...');
  await withRootPackageRestore('electron-builder dir', () => build({
    targets: Platform.WINDOWS.createTarget('dir', Arch.x64),
    publish: 'never',
    config: {
      appId: 'com.credgestor.desktop',
      productName: 'CredGestor',
      copyright: 'Copyright Carlos Antonio de Oliveira Piquet',
      npmRebuild: false,
      buildDependenciesFromSource: false,
      asar: true,
      files: [
        'index.html',
        'main.js',
        'main/**/*',
        'offline-services.js',
        'preload.js',
        'js/**/*',
        'dist-renderer/**/*',
        'assets/**/*',
        'package.json',
      ],
      extraResources: [],
      directories: { output: distDir },
      win: {
        icon: path.join(ROOT, 'assets', 'icon.ico'),
        artifactName: 'CredGestor-Setup-${version}.${ext}',
        signAndEditExecutable: false,
        verifyUpdateCodeSignature: false,
      },
    },
  }));
  log(`PASSO 1 OK - ${relative(unpackedDir)}`);
}

function copyExternalResources() {
  log('PASSO 2: copiando recursos externos...');

  robocopy(
    path.join(ROOT, 'backend'),
    path.join(resourcesDir, 'backend'),
    [
      path.join(ROOT, 'backend', 'data'),
      path.join(ROOT, 'backend', 'node_modules', 'credgestor'),
    ],
    ['.env', '.env.local']
  );

  removePathIfExists(path.join(resourcesDir, 'backend', 'data'), 'backend/data');
  removePathIfExists(
    path.join(resourcesDir, 'backend', 'node_modules', 'credgestor'),
    'junction backend/node_modules/credgestor'
  );
  copyBackendRuntimeDependencies();

  robocopy(
    path.join(ROOT, '.tools', 'node-v22.22.2-win-x64'),
    path.join(resourcesDir, 'node-runtime', 'win-x64')
  );
  log('PASSO 2 OK - recursos externos prontos');
}

async function prepareWinUnpacked() {
  cleanupNsisArtifacts();
  cleanupDistTempArtifacts();
  removePathIfExists(path.join(distDir, 'build-error.log'), 'build-error.log residual');
  removePathIfExists(unpackedDir, 'win-unpacked residual');

  buildRendererAssets();
  await buildWinUnpacked();
  copyExternalResources();

  const missing = getMissingDistributionFiles();
  if (missing.length > 0) {
    throw new Error(`Distribuicao incompleta. Arquivos ausentes: ${missing.map(relative).join(', ')}`);
  }
  log('VALIDACAO OK - win-unpacked completo');
}

function findInnoCompiler() {
  const candidates = [
    process.env.ISCC,
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const where = spawnSync('where', ['ISCC'], { windowsHide: true, encoding: 'utf8' });
  if (where.status === 0) {
    const first = String(where.stdout || '').split(/\r?\n/).map(s => s.trim()).find(Boolean);
    if (first && fs.existsSync(first)) return first;
  }

  return null;
}

function buildInnoInstaller() {
  if (!fs.existsSync(innoScript)) {
    throw new Error(`Script Inno nao encontrado: ${relative(innoScript)}`);
  }

  const iscc = findInnoCompiler();
  if (!iscc) {
    throw new Error('Inno Setup 6 nao encontrado. Instale o Inno Setup ou defina ISCC no ambiente.');
  }

  removePathIfExists(innoOutput, `Inno residual ${path.basename(innoOutput)}`);
  log(`PASSO 3: compilando Inno com ${iscc}`);
  const result = spawnSync(iscc, ['/Q', innoScript], {
    cwd: ROOT,
    windowsHide: true,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });

  const innoLogPath = path.join(distDir, 'inno-build.log');
  fs.writeFileSync(
    innoLogPath,
    `${result.stdout || ''}${result.stderr ? `\n${result.stderr}` : ''}`,
    'utf8'
  );

  if (result.status !== 0) {
    const err = `Inno Setup falhou (exit ${result.status})${result.error ? `: ${result.error.message}` : ''}. Log: ${relative(innoLogPath)}`;
    log(err);
    throw new Error(err);
  }

  if (!fs.existsSync(innoOutput)) {
    throw new Error(`Inno terminou sem gerar o arquivo esperado: ${relative(innoOutput)}`);
  }
  log(`PASSO 3 OK - Inno gerado: ${relative(innoOutput)} (${(fs.statSync(innoOutput).size / 1024 / 1024).toFixed(1)} MB)`);
}

function sha512Base64(filePath) {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');
}

function writeNsisUpdateMetadata() {
  const installerName = `CredGestor-Setup-${pkg.version}.exe`;
  const installerPath = path.join(distDir, installerName);
  const blockmapPath = `${installerPath}.blockmap`;
  const latestPath = path.join(distDir, 'latest.yml');

  if (!fs.existsSync(installerPath)) {
    throw new Error(`NSIS terminou sem gerar o instalador esperado para update: ${relative(installerPath)}`);
  }

  const installerSize = fs.statSync(installerPath).size;
  const installerSha512 = sha512Base64(installerPath);
  const lines = [
    `version: ${pkg.version}`,
    'files:',
    `  - url: ${installerName}`,
    `    sha512: ${installerSha512}`,
    `    size: ${installerSize}`,
  ];

  if (fs.existsSync(blockmapPath)) {
    lines.push(`    blockMapSize: ${fs.statSync(blockmapPath).size}`);
  }

  lines.push(
    `path: ${installerName}`,
    `sha512: ${installerSha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    ''
  );

  fs.writeFileSync(latestPath, lines.join('\n'), 'utf8');
  log(`PASSO 4 OK - metadata de update gerado: ${relative(latestPath)}`);
}

async function buildNsisInstaller() {
  log('PASSO 4: gerando instalador NSIS sob demanda...');
  cleanupNsisArtifacts();
  await withRootPackageRestore('electron-builder nsis', () => build({
    targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
    publish: 'never',
    prepackaged: unpackedDir,
    config: {
      appId: 'com.credgestor.desktop',
      productName: 'CredGestor',
      directories: { output: distDir },
      win: {
        icon: path.join(ROOT, 'assets', 'icon.ico'),
        artifactName: 'CredGestor-Setup-${version}.${ext}',
        signAndEditExecutable: false,
        verifyUpdateCodeSignature: false,
      },
      nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'CredGestor',
        installerIcon: path.join(ROOT, 'assets', 'icon.ico'),
        uninstallerIcon: path.join(ROOT, 'assets', 'icon.ico'),
        license: path.join(ROOT, 'installer', 'LICENSE-NSIS.txt'),
      },
    },
  }));
  writeNsisUpdateMetadata();
  log('PASSO 4 OK - NSIS gerado');
}

function getTarget() {
  const arg = process.argv.find(item => item.startsWith('--target='));
  const target = arg ? arg.slice('--target='.length).toLowerCase() : 'inno';
  if (!['dir', 'inno', 'nsis', 'all'].includes(target)) {
    throw new Error(`Alvo invalido: ${target}. Use dir, inno, nsis ou all.`);
  }
  return target;
}

function writeResult(target) {
  const generated = fs.readdirSync(distDir)
    .filter((name) => {
      if (/^CredGestor-Setup-.*\.(exe|blockmap)$/i.test(name)) return true;
      if (/^latest\.ya?ml$/i.test(name)) return true;
      if ((target === 'inno' || target === 'all') && /^CredGestor-InnoSetup-.*\.exe$/i.test(name)) return true;
      return false;
    })
    .sort();

  fs.writeFileSync(
    path.join(distDir, 'build-result.json'),
    JSON.stringify({ target, generated, ts: new Date().toISOString() }, null, 2),
    'utf8'
  );

  log(`build-success target=${target} arquivos=${generated.join(', ') || '(nenhum instalador)'}`);
  console.log('\nBUILD CONCLUIDO COM SUCESSO');
  console.log('dist:', distDir);
  for (const file of generated) console.log(' -', file);
  console.log('win-unpacked:', unpackedDir);
}

let build, Platform, Arch;
try {
  const eb = require('electron-builder');
  build = eb.build;
  Platform = eb.Platform;
  Arch = eb.Arch;
} catch (error) {
  console.error('[BUILD] electron-builder nao encontrado. Execute: npm install');
  process.exit(1);
}

async function main() {
  const target = getTarget();
  await prepareWinUnpacked();

  if (target === 'inno' || target === 'all') {
    buildInnoInstaller();
  }
  if (target === 'nsis' || target === 'all') {
    await buildNsisInstaller();
  }

  writeResult(target);
}

main().catch((error) => {
  const payload = {
    message: error?.message,
    code: error?.code,
    stack: error?.stack,
    stdout: error?.stdout,
    stderr: error?.stderr,
  };
  fs.writeFileSync(path.join(distDir, 'build-error.log'), JSON.stringify(payload, null, 2), 'utf8');
  log(`build-failed: ${payload.message || 'unknown'}`);
  console.error('\nBUILD FALHOU:', error.message);
  console.error('Verifique:', path.join(distDir, 'build-error.log'));
  process.exit(1);
});
