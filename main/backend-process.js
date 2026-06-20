const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

const BUNDLED_NODE_VERSION = 'v22.22.2';
const BUNDLED_NODE_RUNTIME_RELATIVE = path.join('node-runtime', 'win-x64', 'node.exe');
const BACKEND_START_TIMEOUT_MS = 15000;

function createBackendProcessManager({ app, dialog, rootDir, isDev, logSuppressedError }) {
  let backendProcess = null;
  let backendPort = 4000;
  let backendReady = false;
  let backendStartTimer = null;
  let lastBackendFailure = '';
  const systemApiKey = crypto.randomBytes(32).toString('hex');

  function uniquePaths(paths) {
    const out = [];
    const seen = new Set();
    for (const item of paths || []) {
      if (!item) continue;
      const key = path.resolve(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }

  function resolveFirstExistingPath(paths) {
    for (const candidate of uniquePaths(paths)) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch (error) {
        logSuppressedError(`falha ao verificar caminho ${candidate}`, error);
      }
    }
    return null;
  }

  function getBackendPathCandidates() {
    if (isDev) {
      return [path.join(rootDir, 'backend', 'server.js')];
    }

    return uniquePaths([
      path.join(process.resourcesPath, 'backend', 'server.js'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'server.js'),
      path.join(path.dirname(process.execPath), 'resources', 'backend', 'server.js'),
    ]);
  }

  function getBackendPath() {
    const resolved = resolveFirstExistingPath(getBackendPathCandidates());
    return resolved || getBackendPathCandidates()[0];
  }

  function buildSubprocessEnv() {
    const blocked = new Set([
      'CLOUD_MASTER_KEY',
      'CLOUD_ACCESS_KEY',
      'CLOUD_URL_BASE',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'AUTH_API_KEY',
      'JWT_SECRET',
      'ELECTRON_RUN_AS_NODE',
    ]);
    const out = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (blocked.has(key)) continue;
      out[key] = value;
    }
    return out;
  }

  function getSystemNodePath() {
    try {
      const output = execSync('where node', { encoding: 'utf-8', windowsHide: true });
      const lines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const nodePath = lines[0];
      if (nodePath && fs.existsSync(nodePath)) return nodePath;
    } catch (error) {
      logSuppressedError('falha ao localizar node no sistema', error);
    }
    return null;
  }

  function getBundledNodePath() {
    const candidates = isDev
      ? [path.join(rootDir, '.tools', 'node-v22.22.2-win-x64', 'node.exe')]
      : [
        path.join(process.resourcesPath, BUNDLED_NODE_RUNTIME_RELATIVE),
        path.join(path.dirname(process.execPath), 'resources', BUNDLED_NODE_RUNTIME_RELATIVE),
        path.join(process.resourcesPath, 'app.asar.unpacked', BUNDLED_NODE_RUNTIME_RELATIVE),
      ];

    return resolveFirstExistingPath(candidates);
  }

  function setupDownloadsFolder(userDataPath) {
    const downloadsDir = path.join(userDataPath, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const searchDirs = isDev
      ? [path.join(rootDir, 'dist')]
      : [path.join(process.resourcesPath, '..'), process.resourcesPath];
    const acceptedExtensions = ['.exe', '.appimage', '.deb', '.rpm', '.tar.gz'];

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const fileName of files) {
          const lower = fileName.toLowerCase();
          const isInstaller = acceptedExtensions.some(ext => lower.endsWith(ext));
          if (!isInstaller) continue;

          const src = path.join(dir, fileName);
          const dst = path.join(downloadsDir, fileName);
          const shouldCopy = !fs.existsSync(dst) || fs.statSync(src).size !== fs.statSync(dst).size;
          if (shouldCopy) {
            fs.copyFileSync(src, dst);
            console.log('[CredGestor] Instalador copiado para downloads: ' + fileName);
          }
        }
      } catch (error) {
        logSuppressedError(`erro ao buscar instaladores em ${dir}`, error);
      }
    }

    console.log('[CredGestor] Pasta de downloads: ' + downloadsDir);
  }

  function clearBackendStartTimer() {
    if (backendStartTimer) {
      clearTimeout(backendStartTimer);
      backendStartTimer = null;
    }
  }

  function waitUntilReady(timeoutMs = BACKEND_START_TIMEOUT_MS) {
    if (backendReady) return Promise.resolve(true);

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (backendReady) {
          clearInterval(timer);
          resolve(true);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });
  }

  function resolvePersistentJwtSecret(userDataPath) {
    const jwtSecretPath = path.join(userDataPath, '.jwt_secret');
    let persistentJwtSecret = '';
    try {
      if (fs.existsSync(jwtSecretPath)) {
        persistentJwtSecret = fs.readFileSync(jwtSecretPath, 'utf8').trim();
      }
      if (!persistentJwtSecret || persistentJwtSecret.length < 32) {
        persistentJwtSecret = crypto.randomBytes(48).toString('base64');
        fs.writeFileSync(jwtSecretPath, persistentJwtSecret, { encoding: 'utf8', mode: 0o600 });
        console.log('[CredGestor] JWT_SECRET gerado e salvo em:', jwtSecretPath);
      }
    } catch (error) {
      logSuppressedError('erro ao persistir JWT_SECRET', error);
      persistentJwtSecret = crypto.randomBytes(48).toString('base64');
    }
    return persistentJwtSecret;
  }

  function start(userDataPath) {
    const backendCandidates = getBackendPathCandidates();
    const serverPath = getBackendPath();
    console.log('[CredGestor] Tentando iniciar backend em:', serverPath);

    if (!fs.existsSync(serverPath)) {
      console.error('[CredGestor] Backend nao encontrado em:', serverPath);
      console.error('[CredGestor] Caminhos testados para backend:', backendCandidates);
      dialog.showErrorBox(
        'CredGestor',
        `Backend nao encontrado. Verifique os arquivos de distribuicao.\n\nCaminhos testados:\n${backendCandidates.join('\n')}`
      );
      return;
    }

    const dbPath = path.join(userDataPath, 'credgestor-api.db');
    console.log('[CredGestor] DB_PATH para backend:', dbPath);
    setupDownloadsFolder(userDataPath);

    const launchers = [];
    const bundledNodePath = getBundledNodePath();
    if (bundledNodePath) {
      launchers.push({
        command: bundledNodePath,
        args: [serverPath],
        extraEnv: {},
        label: `Node embarcado (${BUNDLED_NODE_VERSION})`,
      });
    }

    const systemNodePath = getSystemNodePath();
    if (systemNodePath) {
      launchers.push({
        command: systemNodePath,
        args: [serverPath],
        extraEnv: {},
        label: 'Node do sistema',
      });
    }

    launchers.push({
      command: process.execPath,
      args: [serverPath],
      extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
      label: 'Node embarcado (fallback)',
    });

    const baseEnv = {
      ...buildSubprocessEnv(),
      CREDGESTOR_EMBEDDED: '1',
      CREDGESTOR_APP_VERSION: app.getVersion(),
      PORT: String(backendPort),
      DB_PATH: dbPath,
      NODE_ENV: isDev ? 'development' : 'production',
      CORS_ORIGIN: 'http://localhost',
      JWT_SECRET: resolvePersistentJwtSecret(userDataPath),
      SYSTEM_API_KEY: systemApiKey,
    };

    let currentLauncher = 0;
    const startWithLauncher = () => {
      if (currentLauncher >= launchers.length) {
        dialog.showErrorBox(
          'CredGestor',
          `Nao foi possivel iniciar o backend local.${lastBackendFailure ? `\n\nUltimo erro:\n${lastBackendFailure}` : ''}`
        );
        return;
      }

      const launcher = launchers[currentLauncher++];
      console.log('[CredGestor] Iniciando backend com:', launcher.label, launcher.command);

      backendReady = false;
      backendProcess = spawn(launcher.command, launcher.args, {
        cwd: path.dirname(launcher.args[0]),
        env: { ...baseEnv, ...launcher.extraEnv },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true,
      });

      clearBackendStartTimer();
      backendStartTimer = setTimeout(() => {
        if (!backendReady) {
          console.error('[CredGestor] Backend nao sinalizou pronto apos timeout');
        }
      }, BACKEND_START_TIMEOUT_MS);

      if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (data) => {
          const text = data.toString().trim();
          if (!text) return;
          console.log('[Backend]', text);

          const portMatch = text.match(/localhost:(\d+)/);
          if (portMatch) {
            backendPort = parseInt(portMatch[1], 10);
            backendReady = true;
            clearBackendStartTimer();
            console.log('[CredGestor] Backend API pronto na porta ' + backendPort);
          }
        });
      }

      if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg) {
            lastBackendFailure = msg.slice(-4000);
            console.error('[Backend ERROR] ' + msg);
          }
        });
      }

      backendProcess.once('exit', (code) => {
        const wasReady = backendReady;
        clearBackendStartTimer();
        backendReady = false;
        backendProcess = null;

        if (!wasReady && currentLauncher < launchers.length) {
          console.warn('[CredGestor] Backend falhou no launcher atual. Tentando fallback...');
          startWithLauncher();
          return;
        }

        if (!wasReady) {
          const exitDetail = code === null ? 'processo encerrado sem codigo de saida' : `processo encerrado com codigo ${code}`;
          lastBackendFailure = lastBackendFailure || exitDetail;
          dialog.showErrorBox(
            'CredGestor',
            `Nao foi possivel iniciar o backend local.\n\nUltimo erro:\n${lastBackendFailure}`
          );
          return;
        }

        if (code !== 0 && code !== null) {
          console.error('[CredGestor] Backend encerrou com codigo ' + code);
        }
      });

      backendProcess.once('error', (error) => {
        clearBackendStartTimer();
        backendReady = false;
        backendProcess = null;
        console.error('[CredGestor] Erro ao iniciar backend:', error.message);

        if (currentLauncher < launchers.length) {
          console.warn('[CredGestor] Tentando fallback de inicializacao do backend...');
          startWithLauncher();
        } else {
          lastBackendFailure = error.message;
          dialog.showErrorBox('CredGestor', 'Falha ao iniciar backend local: ' + error.message);
        }
      });
    };

    startWithLauncher();
  }

  function stop() {
    clearBackendStartTimer();
    backendReady = false;

    if (backendProcess) {
      try {
        backendProcess.kill('SIGTERM');
      } catch (error) {
        logSuppressedError('falha ao encerrar backend', error);
      }
      backendProcess = null;
    }
  }

  return {
    start,
    stop,
    isReady: () => backendReady,
    waitUntilReady,
    getBackendPort: () => backendPort,
    getBackendUrl: () => `http://localhost:${backendPort}`,
    getSystemApiKey: () => systemApiKey,
  };
}

module.exports = { createBackendProcessManager };
