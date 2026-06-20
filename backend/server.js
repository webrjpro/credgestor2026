/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CREDGESTOR — Backend API REST                                      ║
 * ║  Express 4.x + better-sqlite3 + JWT + Multi-tenancy                ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                     ║
 * ║  MODOS DE EXECUÇÃO:                                                 ║
 * ║  1. Standalone  — `node server.js` (desenvolvimento/produção)       ║
 * ║  2. Embarcado   — Spawned pelo Electron                             ║
 * ║                                                                     ║
 * ║  No modo embarcado o servidor roda silencioso e notifica o          ║
 * ║  processo pai via IPC quando estiver pronto.                        ║
 * ║                                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const { initDatabase, closeDatabase, run, queryOne } = require('./src/database');
const authRoutes = require('./src/routes/auth.routes');
const clientesRoutes = require('./src/routes/clientes.routes');
const emprestimosRoutes = require('./src/routes/emprestimos.routes');
const transacoesRoutes = require('./src/routes/transacoes.routes');
const caixaRoutes = require('./src/routes/caixa.routes');
const statsRoutes = require('./src/routes/stats.routes');
const configRoutes = require('./src/routes/config.routes');
const arquivoRoutes = require('./src/routes/arquivo.routes');
const recibosRoutes = require('./src/routes/recibos.routes');
const systemRoutes = require('./src/routes/system.routes');
const tenantsRoutes = require('./src/routes/tenants.routes');
const { assertAuthSecrets } = require('./src/middleware/auth');

// ── Modo embarcado ──
// Nota: em modo embarcado, mantemos console.log ativo para que o processo pai
// (Electron) possa detectar quando o servidor está pronto via stdout.
const EMBEDDED = process.env.CREDGESTOR_EMBEDDED === '1';
const log = console.log;
const logError = console.error;
const PORT = parseInt(process.env.PORT, 10) || 4000;
const MAX_PORT_RETRIES = 5;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'credgestor-api.db');
const APP_VERSION = process.env.CREDGESTOR_APP_VERSION || '6.0.0';

let activePort = PORT;
let currentServer = null;
let isShuttingDown = false;

function isDatabaseHealthy() {
  try {
    const probe = queryOne('SELECT 1 as ok');
    return probe && probe.ok === 1;
  } catch (_) {
    return false;
  }
}

function getRuntimeSnapshot() {
  const memory = process.memoryUsage();
  return {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    hostName: os.hostname(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMB: {
      rss: Number((memory.rss / 1024 / 1024).toFixed(2)),
      heapUsed: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotal: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
    },
  };
}

// ── Handlers globais de erro — evita crashes silenciosos em produção ──
process.on('unhandledRejection', (reason, promise) => {
  logError('[FATAL] Unhandled Promise Rejection:', reason);
  // Não encerra o processo — apenas loga. Em produção, o servidor deve continuar rodando.
});

process.on('uncaughtException', (err) => {
  logError('[FATAL] Uncaught Exception:', err.stack || err.message);
  // Encerra graciosamente após logar
  try { closeDatabase(); } catch (error) { logError('[FATAL] Falha ao fechar banco apos excecao:', error.message); }
  process.exit(1);
});

const app = express();

try {
  assertAuthSecrets();
} catch (err) {
  logError('[FATAL] Configuracao de autenticacao invalida:', err.message);
  process.exit(1);
}

// ── Segurança ──
app.use(helmet({
  contentSecurityPolicy: false,        // Landing page usa inline style
  crossOriginOpenerPolicy: false,      // Não funciona em HTTP puro (rede local)
  crossOriginEmbedderPolicy: false,
  originAgentCluster: false,
}));

// ── CORS ──
const STATIC_LOCAL_ORIGINS = ['http://localhost', 'http://127.0.0.1'];

function isAllowedEmbeddedOrigin(origin) {
  if (!origin) return true; // file://, null, requests internas do Electron
  if (origin === 'null' || origin.startsWith('file://')) return true;
  try {
    const u = new URL(origin);
    const base = `${u.protocol}//${u.hostname}`;
    if (STATIC_LOCAL_ORIGINS.includes(base)) return true;
    return false;
  } catch (_) {
    return false;
  }
}

app.use(cors({
  origin: EMBEDDED
    ? (origin, cb) => cb(null, isAllowedEmbeddedOrigin(origin))
    : (process.env.CORS_ORIGIN || 'http://localhost:3333').split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-System-Key'],
}));

// ── Parsing ──
app.use((req, res, next) => {
  const requestId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (res.statusCode >= 500 || durationMs >= 1000) {
      const tag = res.statusCode >= 500 ? '[REQ_ERROR]' : '[REQ_SLOW]';
      log(
        tag + ' ' +
        req.method + ' ' +
        req.originalUrl +
        ' status=' + res.statusCode +
        ' durationMs=' + durationMs.toFixed(1) +
        ' requestId=' + req.requestId
      );
    }
  });

  next();
});

app.use(express.json({ limit: '10mb' }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'JSON invalido no corpo da requisicao',
      code: 'INVALID_JSON',
      requestId: req.requestId,
    });
  }
  return next(err);
});

// ── Rate Limiting global — valores generosos para app desktop local ──
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  // Não bloquear requests locais (loopback)
  skip: (req) => {
    const ip = req.ip || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
}));

// ── Favicon (evita 404) ──
app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

// ── Health ──
app.get('/health/live', (_req, res) => {
  return res.json({
    status: 'alive',
    mode: EMBEDDED ? 'embedded' : 'standalone',
    timestamp: new Date().toISOString(),
    port: activePort,
    requestId: res.getHeader('X-Request-Id'),
  });
});

app.get('/health/ready', (_req, res) => {
  const databaseOk = isDatabaseHealthy();
  const ready = databaseOk && !isShuttingDown;

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    mode: EMBEDDED ? 'embedded' : 'standalone',
    timestamp: new Date().toISOString(),
    port: activePort,
    databaseOk,
    requestId: res.getHeader('X-Request-Id'),
  });
});

app.get('/health', (_req, res) => {
  const databaseOk = isDatabaseHealthy();
  const payload = {
    status: databaseOk && !isShuttingDown ? 'ok' : 'degraded',
    mode: EMBEDDED ? 'embedded' : 'standalone',
    timestamp: new Date().toISOString(),
    uptimeSeconds: getRuntimeSnapshot().uptimeSeconds,
    port: activePort,
    requestId: res.getHeader('X-Request-Id'),
  };

  return res.status(databaseOk ? 200 : 503).json(payload);
});

app.get('/api/system/status', (_req, res) => {
  const databaseOk = isDatabaseHealthy();
  const runtime = getRuntimeSnapshot();
  const status = databaseOk && !isShuttingDown ? 'ok' : 'degraded';

  return res.status(databaseOk ? 200 : 503).json({
    status,
    app: 'CredGestor',
    appVersion: APP_VERSION,
    mode: EMBEDDED ? 'embedded' : 'standalone',
    port: activePort,
    isShuttingDown,
    database: {
      healthy: databaseOk,
      path: DB_PATH,
    },
    runtime,
    timestamp: new Date().toISOString(),
    requestId: res.getHeader('X-Request-Id'),
  });
});

app.get('/api/system/runtime', (_req, res) => {
  return res.json({
    app: 'CredGestor',
    appVersion: APP_VERSION,
    mode: EMBEDDED ? 'embedded' : 'standalone',
    port: activePort,
    runtime: getRuntimeSnapshot(),
    timestamp: new Date().toISOString(),
    requestId: res.getHeader('X-Request-Id'),
  });
});

// ── Downloads desktop (rede local) ──
function getDownloadsDir() {
  return path.join(path.dirname(DB_PATH), 'downloads');
}

function listDownloadsByExtension(extensions) {
  const dir = getDownloadsDir();
  if (!fs.existsSync(dir)) return [];
  const normalizedExtensions = extensions.map((ext) => ext.toLowerCase());

  try {
    return fs.readdirSync(dir)
      .map((fileName) => {
        const lower = fileName.toLowerCase();
        if (!normalizedExtensions.some((ext) => lower.endsWith(ext))) {
          return null;
        }

        const fullPath = path.join(dir, fileName);
        try {
          const stat = fs.statSync(fullPath);
          return {
            fileName,
            fullPath,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          };
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs || a.fileName.localeCompare(b.fileName));
  } catch (err) {
    logError('[DOWNLOAD] Falha ao listar instaladores:', err.message);
    return [];
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFirstDownloadInfo(extensions) {
  const files = listDownloadsByExtension(extensions);
  if (files.length === 0) return null;
  return files[0];
}

function streamDownload(res, fileInfo, contentType) {
  res.setHeader('Content-Type', contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="' + fileInfo.fileName + '"');
  res.setHeader('Content-Length', fileInfo.size);

  const stream = fs.createReadStream(fileInfo.fullPath);
  stream.on('error', (err) => {
    logError('[DOWNLOAD] Falha ao abrir arquivo: ' + err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Falha ao enviar arquivo de download' });
    }
  });
  stream.pipe(res);
}

app.get('/download/windows', (_req, res) => {
  try {
    const windows = getFirstDownloadInfo(['.exe']);
    if (!windows) {
      return res.status(404).json({
        error: 'Instalador Windows nao disponivel.',
        requestId: res.getHeader('X-Request-Id'),
      });
    }
    return streamDownload(res, windows, 'application/octet-stream');
  } catch (err) {
    logError('[DOWNLOAD] Falha no /download/windows:', err.message);
    return res.status(500).json({
      error: 'Erro ao preparar download Windows',
      requestId: res.getHeader('X-Request-Id'),
    });
  }
});

app.get('/download/info', (_req, res) => {
  try {
    const windows = getFirstDownloadInfo(['.exe']);
    return res.json({
      windows: windows ? { name: windows.fileName, size: windows.size } : null,
      requestId: res.getHeader('X-Request-Id'),
    });
  } catch (err) {
    logError('[DOWNLOAD] Falha em /download/info:', err.message);
    return res.status(500).json({
      error: 'Erro ao consultar instaladores disponiveis',
      requestId: res.getHeader('X-Request-Id'),
    });
  }
});

app.get('/api/system/installers', (_req, res) => {
  try {
    const windows = getFirstDownloadInfo(['.exe']);
    return res.json({
      downloadsDir: getDownloadsDir(),
      windows: windows
        ? { name: windows.fileName, size: windows.size, updatedAt: new Date(windows.mtimeMs).toISOString() }
        : null,
      timestamp: new Date().toISOString(),
      requestId: res.getHeader('X-Request-Id'),
    });
  } catch (err) {
    logError('[DOWNLOAD] Falha em /api/system/installers:', err.message);
    return res.status(500).json({
      error: 'Erro ao consultar inventario de instaladores',
      requestId: res.getHeader('X-Request-Id'),
    });
  }
});

app.get('/', (_req, res) => {
  const windows = getFirstDownloadInfo(['.exe']);

  const windowsBtn = windows
    ? '<a href="/download/windows" class="btn btn-windows"><span class="btn-icon">&#x229E;</span><div>Baixar instalador Windows<br><span class="btn-info">' + escapeHtml(windows.fileName) + ' &bull; ' + (windows.size / 1024 / 1024).toFixed(1) + ' MB</span></div></a>'
    : '<div class="btn btn-disabled"><span class="btn-icon">&#x229E;</span><div>Instalador Windows<br><span class="btn-info">Nenhum instalador disponivel na pasta downloads</span></div></div>';

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CredGestor &mdash; Servidor Local</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:rgba(30,41,59,0.97);border:1px solid #334155;border-radius:1.5rem;padding:2.5rem;max-width:460px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.5)}
    .logo{font-size:2.8rem;margin-bottom:0.5rem}
    h1{font-size:1.45rem;font-weight:800;background:linear-gradient(135deg,#10b981,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.25rem}
    .version{font-size:0.78rem;color:#64748b;margin-bottom:1.5rem}
    .status{display:inline-flex;align-items:center;gap:0.5rem;padding:0.45rem 1rem;border-radius:9999px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#10b981;font-size:0.82rem;font-weight:600;margin-bottom:1.5rem}
    .dot{width:8px;height:8px;border-radius:50%;background:#10b981;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .info{font-size:0.83rem;color:#94a3b8;line-height:1.6;margin-bottom:1.5rem}
    .downloads{display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.5rem}
    .btn{display:flex;align-items:center;justify-content:center;gap:0.75rem;padding:0.9rem 1.5rem;border-radius:1rem;font-size:0.93rem;font-weight:700;text-decoration:none;transition:all 0.2s;cursor:pointer;border:none}
    .btn-windows{background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff}
    .btn-windows:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(59,130,246,0.45)}
    .btn-disabled{background:#1e293b;color:#475569;cursor:not-allowed;border:1px solid #334155}
    .btn-icon{font-size:1.2rem}
    .btn-info{font-size:0.68rem;color:rgba(255,255,255,0.65);font-weight:400}
    .divider{border-top:1px solid #1e293b;margin:1rem 0}
    .footer{font-size:0.72rem;color:#334155}
    .health{display:inline-flex;gap:1.5rem;margin-top:0.75rem}
    .health a{font-size:0.72rem;color:#475569;text-decoration:none;padding:0.2rem 0.5rem;border:1px solid #334155;border-radius:0.4rem;transition:color 0.2s}
    .health a:hover{color:#94a3b8}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">&#x1F4B0;</div>
    <h1>CredGestor</h1>
    <div class="version">v${escapeHtml(APP_VERSION)} &bull; Windows x64</div>
    <div class="status"><span class="dot"></span>&nbsp;Servidor API ativo na porta ${activePort}</div>
    <p class="info">Servidor de backend rodando localmente.<br>Acesse pelo aplicativo desktop instalado em seu computador.</p>
    <div class="downloads">${windowsBtn}</div>
    <div class="divider"></div>
    <div class="health">
      <a href="/health">/health</a>
      <a href="/health/ready">/health/ready</a>
      <a href="/api/system/status">/status</a>
    </div>
    <p class="footer" style="margin-top:1rem">CredGestor &copy; ${new Date().getFullYear()} &bull; API REST Local &bull; Windows Only</p>
  </div>
</body>
</html>`);
});

app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/emprestimos', emprestimosRoutes);
app.use('/api/transacoes', transacoesRoutes);
app.use('/api/caixa', caixaRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/arquivo', arquivoRoutes);
app.use('/api/recibos', recibosRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/tenants', tenantsRoutes);

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    code: 'NOT_FOUND',
    requestId: req.requestId,
  });
});

// ── Error Handler ──
app.use((err, req, res, _next) => {
  logError('[ERROR]', err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
    requestId: req.requestId,
  });
});

// ── Start — banco local primeiro ──
initDatabase(DB_PATH);

// Limpeza de startup: remover refresh tokens expirados
try {
  const cleaned = run('DELETE FROM refresh_tokens WHERE expires_at < ?', [new Date().toISOString()]);
  if (cleaned.changes > 0) {
    log('[STARTUP] ' + cleaned.changes + ' refresh tokens expirados removidos');
  }
} catch (_) { /* tabela pode nao existir ainda */ }

// Limpeza de startup: remover blacklist expirado de access tokens
try {
  const cleaned = run('DELETE FROM revoked_tokens WHERE expires_at < ?', [new Date().toISOString()]);
  if (cleaned.changes > 0) {
    log('[STARTUP] ' + cleaned.changes + ' tokens revogados expirados removidos');
  }
} catch (_) { /* tabela pode nao existir ainda */ }

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('[' + signal + '] Encerrando servidor...');

  if (!currentServer) {
    try { closeDatabase(); } catch (error) { logError('[SHUTDOWN] Falha ao fechar banco sem servidor:', error.message); }
    process.exit(0);
    return;
  }

  const forceTimer = setTimeout(() => {
    logError('[SHUTDOWN] Timeout - forçando encerramento');
    try { closeDatabase(); } catch (error) { logError('[SHUTDOWN] Falha ao fechar banco no timeout:', error.message); }
    process.exit(1);
  }, 5000);

  currentServer.close((err) => {
    clearTimeout(forceTimer);
    try { closeDatabase(); } catch (error) { logError('[SHUTDOWN] Falha ao fechar banco:', error.message); }

    if (err) {
      logError('[SHUTDOWN] Erro ao encerrar servidor:', err.message);
      process.exit(1);
      return;
    }

    log('[SHUTDOWN] Servidor encerrado com sucesso');
    process.exit(0);
  });
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));

function startServer(port, retries = 0) {
  const server = app.listen(port, '127.0.0.1', () => {
    const addr = server.address();
    activePort = addr.port;
    currentServer = server;

    log('\n==============================================');
    log('CredGestor API - http://localhost:' + activePort);
    log('==============================================\n');

    // Notifica processo pai (Electron) que o servidor esta pronto
    if (EMBEDDED && process.send) {
      process.send({ type: 'ready', port: activePort });
    }
  });

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && retries < MAX_PORT_RETRIES) {
      const nextPort = port + 1;
      log('[WARN] Porta ' + port + ' ocupada, tentando ' + nextPort + '...');
      return startServer(nextPort, retries + 1);
    }

    logError('[FATAL] Nao foi possivel iniciar o servidor:', err.message);
    process.exit(1);
  });
}

startServer(PORT);

module.exports = app;
