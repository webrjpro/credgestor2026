const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const electronPath = require('electron');
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [ROOT, ...process.argv.slice(2)], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('error', (error) => {
  console.error('[CredGestor] Falha ao iniciar Electron:', error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
