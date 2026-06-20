// SEÇÃO 20 — AUTENTICAÇÃO (SQLite Local)
// Toda autenticação agora roda via SQLite no SSD local.
// Senhas são hashadas com SHA-256 + salt no processo principal.
// Recuperação: Senha Master ? Senha Dev ? Novo Cadastro
const SESSION_KEY = 'credgestor_session';
const THEME_KEY = 'credgestor_theme';
const AUTH_STORE = 'authCredentials';

// SEÇÃO 21 — FUNÇÕES DE AUTH (SQLite via IPC)
async function updateLastLogin() {
    // Feito automaticamente pelo SQLite no login
}

async function getLocalCredentials() {
    return await window.db.getCredentials();
}

async function saveLocalCredentials(email, senha, nome = '') {
    return await window.db.register(nome, email, senha);
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'credgestor_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, storedHash) {
    const hash = await hashPassword(password);
    return hash === storedHash;
}

async function loadGestorName() {
    try {
        const creds = await window.db.getCredentials();
        if (creds && creds.nome) {
            localStorage.setItem('gestorNome', creds.nome);
            return creds.nome;
        }
    } catch (e) {
        console.warn('[features] Falha ao obter nome do gestor:', e.message);
    }
    return '';
}

function getGestorName() {
    return localStorage.getItem('gestorNome') || 'Gestor';
}

function updateGestorNameDisplay() {
    const nome = getGestorName();
    const displayEl = document.getElementById('gestor-nome-display');
    if (displayEl) displayEl.textContent = nome || 'Gestor';
}
