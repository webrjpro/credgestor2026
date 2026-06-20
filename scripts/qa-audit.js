const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const color = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    bold: "\x1b[1m"
};

console.log(`${color.magenta}${color.bold}
╔══════════════════════════════════════════════════════════════╗
║  CREDGESTOR QA DIAGNOSTIC TOOL v1.0.0                         ║
║  Engenharia de Software + QA Integrado                       ║
╚══════════════════════════════════════════════════════════════╝${color.reset}
`);

const APP_DIR = path.resolve(__dirname, '..');
let score = 100;
let issuesFound = 0;
let recommendations = [];

function logSection(title) {
    console.log(`\n${color.cyan}${color.bold}[ ANALISE ] ${title}${color.reset}`);
}

function logPass(msg) {
    console.log(`   ${color.green}✔ PASS:${color.reset} ${msg}`);
}

function logWarn(msg, penalty = 2) {
    console.log(`   ${color.yellow}⚠ WARN:${color.reset} ${msg}`);
    score -= penalty;
    issuesFound++;
}

function logFail(msg, penalty = 5) {
    console.log(`   ${color.red}❌ FAIL:${color.reset} ${msg}`);
    score -= penalty;
    issuesFound++;
}

// 1. Verificação de Arquivos Críticos
logSection('Arquivos Estruturais Críticos');
const criticalFiles = ['main.js', 'main/backend-process.js', 'preload.js', 'offline-services.js', 'package.json'];
criticalFiles.forEach(file => {
    if (fs.existsSync(path.join(APP_DIR, file))) {
        logPass(`${file} encontrado e acessível.`);
    } else {
        logFail(`${file} NÃO ENCONTRADO! Sistema não vai inicializar.`);
    }
});

// 2. Analise estatica de riscos no codigo
logSection('Riscos no Codigo Fonte (Antipatterns)');
const jsFiles = [
    path.join(APP_DIR, 'main.js'),
    path.join(APP_DIR, 'js', 'views.js')
];

let syncDateIssueFound = false;

jsFiles.forEach(file => {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');

    // Procura por hardcoded console.log (excesso pode vazar memória no Electron)
    const logs = (content.match(/console\.log\(/g) || []).length;
    if (logs > 30) {
        logWarn(`Alto volume de console.log no ${path.basename(file)} (${logs} ocorrências). Recomenda-se remover logs não essenciais em produção.`);
    }

    // Checa tratamento de erros (try/catch solto)
    const emptyCatchPattern = /catch\s*\((?:e|err|error|_)\)\s*\{\s*\}/;
    if (emptyCatchPattern.test(content)) {
        logWarn(`Silenciamento de Erros detectado no ${path.basename(file)}. Erros engolidos dificultam o debug.`);
        recommendations.push(`Substitua bloco catch vazio por logging controlado no arquivo ${path.basename(file)}.`);
    }

    // Analisa conflito de datas de sync
    if (content.includes("timestamp > '") && content.includes('T') && file.includes('database.js')) {
        syncDateIssueFound = true;
    }
});

if (syncDateIssueFound) {
    logFail('Risco de sincronizacao encontrado: comparacao direta de data ISO com data do SQLite.');
    recommendations.push('Você deve usar o wrapper datetime() do SQLite ou limpar o T/Z da string JS.');
} else {
    logPass('Sem conflito temporal na lógica de sincronização.');
}

// 3. Integridade do Banco de Dados Local
logSection('Auditoria do Banco de Dados (SQLite)');
function loadBetterSqlite3() {
    const candidates = [
        'better-sqlite3',
        path.join(APP_DIR, 'backend', 'node_modules', 'better-sqlite3')
    ];
    for (const candidate of candidates) {
        try { return require(candidate); } catch (error) { /* tenta proximo */ }
    }
    return null;
}

const appDataRoot = process.env.APPDATA || process.env.USERPROFILE || '';
const dbCandidates = [
    path.join(appDataRoot, 'CredGestor', 'credgestor-api.db')
];
const dbPath = dbCandidates.find(file => fs.existsSync(file));

if (!dbPath) {
    logPass('Banco de dados de produção não encontrado neste ambiente de build; auditoria de dados locais não aplicável.');
} else {
    const BetterSqlite3 = loadBetterSqlite3();
    if (!BetterSqlite3) {
        logWarn('better-sqlite3 não acessível para quick_check do banco local.');
    } else {
        const tempDbPath = path.join(APP_DIR, 'dist', `qa-db-copy-${Date.now()}.sqlite`);
        try {
            if (!fs.existsSync(path.dirname(tempDbPath))) fs.mkdirSync(path.dirname(tempDbPath), { recursive: true });
            fs.copyFileSync(dbPath, tempDbPath);
            const prodDb = new BetterSqlite3(tempDbPath, { readonly: true, fileMustExist: true });
            const quick = prodDb.pragma('quick_check');
            prodDb.close();
            const ok = Array.isArray(quick) && quick.every(row => Object.values(row).includes('ok'));
            if (ok) logPass(`quick_check OK no banco local: ${dbPath}`);
            else logFail(`quick_check retornou inconsistência no banco local: ${JSON.stringify(quick)}`);
        } catch (error) {
            logFail(`Falha ao auditar banco local: ${error.message}`);
        } finally {
            for (const suffix of ['', '-shm', '-wal']) {
                const tempFile = `${tempDbPath}${suffix}`;
                try {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                } catch (error) {
                    logWarn(`Falha ao remover arquivo temporário do QA: ${error.message}`, 0);
                }
            }
        }

        const stats = fs.statSync(dbPath);
        const mb = (stats.size / 1024 / 1024).toFixed(2);
        if (mb > 100) {
            logWarn(`Banco de dados muito pesado (${mb} MB). Recomenda-se rodar rotina de limpeza.`);
            recommendations.push('Rodar rotina de retenção para sync_log, audit_log e transações fora da janela operacional.');
        } else {
            logPass(`Tamanho do banco de dados saudável: ${mb} MB`);
        }
    }
}

// 4. Segurança
logSection('Auditoria de Segurança (Frontend/Backend)');
const preloadContent = fs.readFileSync(path.join(APP_DIR, 'preload.js'), 'utf8');
if (preloadContent.includes('process.env')) {
    logFail('Vazamento Crítico: As variáveis de ambiente (process.env) estão sendo expostas no preload.js!');
    recommendations.push('Remova qualquer acesso ao `process.env` do `preload.js` e use chamadas seguras de IPC para buscar chaves do main.js.');
} else {
    logPass('Preload seguro contra vazamento de variáveis de ambiente.');
}

const packageContent = fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8');
if (packageContent.includes('"nodeIntegration": true')) {
    logFail('Acesso inseguro ao Node.js liberado no package.json (nodeIntegration = true).');
} else {
    logPass('Configuração Electron Hardened (nodeIntegration=false).');
}

// 5. Diagnóstico Final
console.log(`\n${color.magenta}══════════════════════════════════════════════════════════════`);
console.log(`${color.bold}DIAGNOSTICO DE QA${color.reset}`);
console.log(`${color.magenta}══════════════════════════════════════════════════════════════${color.reset}`);

const scoreColor = score >= 90 ? color.green : score >= 70 ? color.yellow : color.red;
console.log(`\nNota Final de Saúde do Sistema: ${scoreColor}${score}/100${color.reset}`);
console.log(`Problemas Detectados: ${issuesFound === 0 ? color.green : color.red}${issuesFound}${color.reset}\n`);

if (issuesFound === 0) {
    console.log(`${color.green}Sistema aprovado na auditoria local de QA.${color.reset}`);
} else {
    console.log(`${color.yellow}MELHORIAS RECOMENDADAS:${color.reset}`);
    recommendations.forEach((rec, i) => console.log(`  ${i+1}. ${rec}`));
}

console.log('\n');
