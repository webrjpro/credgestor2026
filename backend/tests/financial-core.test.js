const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BACKEND_DIR = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(BACKEND_DIR, 'server.js');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeHarness() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'credgestor-finance-'));
  const dbPath = path.join(tempDir, 'credgestor-api.db');
  const port = 52000 + Math.floor(Math.random() * 1000);
  const systemKey = `test-key-${Date.now()}`;
  let child = null;

  async function request(pathname, method = 'GET', body = null) {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-System-Key': systemKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    return { response, data, text };
  }

  async function requestOk(pathname, method = 'GET', body = null) {
    const result = await request(pathname, method, body);
    assert.equal(result.response.ok, true, `${method} ${pathname}: ${result.text}`);
    return result.data;
  }

  async function start() {
    child = spawn(process.execPath, [SERVER_PATH], {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: dbPath,
        SYSTEM_API_KEY: systemKey,
        JWT_SECRET: `test-jwt-${'x'.repeat(64)}`,
        CREDGESTOR_EMBEDDED: '1',
        CREDGESTOR_APP_VERSION: 'test',
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    child.stderr.on('data', chunk => process.stderr.write(chunk));

    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
      try {
        const health = await requestOk('/health');
        if (health.status === 'ok') return;
      } catch (_) {
        await delay(200);
      }
    }
    throw new Error('Backend não ficou pronto para teste');
  }

  async function stop() {
    if (!child) return;
    const exiting = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await Promise.race([exiting, delay(5000)]);
    child = null;
  }

  function cleanup() {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return { cleanup, dbPath, request, requestOk, start, stop };
}

test('ledger financeiro mantém caixa consistente em aporte, contrato, transação, restart e reset', async () => {
  const app = makeHarness();
  await app.start();

  try {
    await app.requestOk('/api/system/reset', 'POST');

    const usuario = await app.requestOk('/api/tenants/create-user', 'POST', {
      nome: 'Operador Teste',
      email: 'operador.teste@credgestor.local',
      password: '123456',
      role: 'gestor',
    });
    assert.equal(usuario.user.email, 'operador.teste@credgestor.local');
    assert.equal(usuario.user.role, 'gestor');

    const usuarios = await app.requestOk('/api/tenants/default/users');
    assert.equal(usuarios.users.some(u => u.email === 'operador.teste@credgestor.local'), true);

    const usuarioRemovido = await app.requestOk(`/api/tenants/default/users/${usuario.user.id}`, 'DELETE');
    assert.equal(usuarioRemovido.success, true);

    const cliente = {
      id: 'cliente-financeiro',
      nome: 'Cliente Financeiro',
      cpf: '00000000000',
      limite: 100000,
    };
    await app.requestOk('/api/clientes', 'POST', cliente);

    const semCaixa = await app.request('/api/emprestimos', 'POST', {
      id: 'emp-sem-caixa',
      clienteId: cliente.id,
      valorOriginal: 10000,
      taxaJuros: 10,
      valorTotal: 11000,
      parcelas: [{ numero: 1, status: 'pendente', valorBase: 11000 }],
      aprovacao: 'aprovado',
    });
    assert.equal(semCaixa.response.status, 409);
    assert.equal(semCaixa.data.code, 'INSUFFICIENT_CASH');

    await app.requestOk('/api/caixa/historico', 'POST', {
      tipo: 'entrada',
      valor: 50000,
      descricao: 'Aporte inicial',
      data: '2026-06-15',
    });
    await app.requestOk('/api/caixa/historico', 'POST', {
      tipo: 'entrada',
      valor: 10000,
      descricao: 'Aporte teste',
      data: '2026-06-15',
    });

    let caixa = await app.requestOk('/api/caixa');
    assert.equal(caixa.saldo, 60000);

    await app.stop();
    await app.start();
    caixa = await app.requestOk('/api/caixa');
    assert.equal(caixa.saldo, 60000);

    const emprestimo = await app.requestOk('/api/emprestimos', 'POST', {
      id: 'emp-aprovado',
      clienteId: cliente.id,
      valorOriginal: 10000,
      taxaJuros: 10,
      valorTotal: 11000,
      parcelas: [{ numero: 1, status: 'pendente', valorBase: 11000 }],
      aprovacao: 'aprovado',
    });
    assert.equal(emprestimo.caixa.saldo, 50000);

    let historico = await app.requestOk('/api/caixa/historico');
    assert.equal(historico.pagination.total, 3);

    const emAnalise = await app.requestOk('/api/emprestimos/emp-aprovado', 'PUT', {
      aprovacao: 'em_analise',
    });
    assert.equal(emAnalise.caixa.saldo, 60000);

    const reprovado = await app.requestOk('/api/emprestimos/emp-aprovado', 'PUT', {
      aprovacao: 'aprovado',
    });
    assert.equal(reprovado.caixa.saldo, 50000);

    const pagamentoEmprestimo = await app.requestOk('/api/emprestimos/emp-aprovado/pagar', 'POST', {
      valor: 1500,
      observacao: 'Pagamento teste',
      parcelas: [{ numero: 1, status: 'pago', valorPago: 1500 }],
      statusGeral: 'finalizado',
      scoreEventos: [{ pagouComMulta: false }],
    });
    assert.equal(pagamentoEmprestimo.caixa.saldo, 51500);
    assert.equal(pagamentoEmprestimo.emprestimo.statusGeral, 'finalizado');
    assert.equal(pagamentoEmprestimo.transacao.valor, 1500);
    assert.equal(pagamentoEmprestimo.cliente.scoreCredito, 500);
    assert.equal(pagamentoEmprestimo.cliente.pagamentosEmDia, 1);
    assert.equal(pagamentoEmprestimo.cliente.blacklist, false);

    const exclusaoComPagamento = await app.request('/api/emprestimos/emp-aprovado', 'DELETE');
    assert.equal(exclusaoComPagamento.response.status, 409);
    assert.equal(exclusaoComPagamento.data.code, 'LOAN_HAS_PAYMENTS');
    caixa = await app.requestOk('/api/caixa');
    assert.equal(caixa.saldo, 51500);

    const transacaoAvulsa = await app.requestOk('/api/transacoes', 'POST', {
      id: 'tx-avulsa',
      tipo: 'entrada',
      valor: 500,
      descricao: 'Entrada avulsa teste',
      data: '2026-06-15',
    });
    assert.equal(transacaoAvulsa.caixa.saldo, 52000);

    const estorno = await app.requestOk('/api/transacoes/tx-avulsa', 'DELETE');
    assert.equal(estorno.caixa.saldo, 51500);

    await app.requestOk('/api/clientes', 'POST', {
      id: 'cliente-score-sem-evento',
      nome: 'Cliente Score Sem Evento',
      cpf: '22222222222',
      limite: 100000,
      scoreCredito: 350,
      pagamentosEmDia: 4,
    });
    await app.requestOk('/api/emprestimos', 'POST', {
      id: 'emp-score-sem-evento',
      clienteId: 'cliente-score-sem-evento',
      valorOriginal: 1000,
      taxaJuros: 0,
      valorTotal: 1000,
      parcelas: [{ numero: 1, status: 'pendente', valorBase: 1000 }],
      aprovacao: 'aprovado',
    });
    const pagamentoSemEvento = await app.requestOk('/api/emprestimos/emp-score-sem-evento/pagar', 'POST', {
      valor: 1000,
      observacao: 'Pagamento sem evento de score',
      parcelas: [{ numero: 1, status: 'pago', valorPago: 1000 }],
      statusGeral: 'finalizado',
    });
    assert.equal(pagamentoSemEvento.caixa.saldo, 51500);
    assert.equal(pagamentoSemEvento.cliente.scoreCredito, 350);
    assert.equal(pagamentoSemEvento.cliente.pagamentosEmDia, 4);

    await app.requestOk('/api/clientes', 'POST', {
      id: 'cliente-score-atraso',
      nome: 'Cliente Score Atraso',
      cpf: '33333333333',
      limite: 100000,
      scoreCredito: 100,
      pagamentosEmDia: 8,
    });
    await app.requestOk('/api/emprestimos', 'POST', {
      id: 'emp-score-atraso',
      clienteId: 'cliente-score-atraso',
      valorOriginal: 1000,
      taxaJuros: 0,
      valorTotal: 1000,
      parcelas: [
        { numero: 1, status: 'pendente', valorBase: 500 },
        { numero: 2, status: 'pendente', valorBase: 500 },
      ],
      aprovacao: 'aprovado',
    });
    const pagamentoAtrasado = await app.requestOk('/api/emprestimos/emp-score-atraso/pagar', 'POST', {
      valor: 1000,
      observacao: 'Pagamento atrasado com duas parcelas',
      parcelas: [
        { numero: 1, status: 'pago', valorPago: 500, multaPaga: 10 },
        { numero: 2, status: 'pago', valorPago: 500, multaPaga: 10 },
      ],
      statusGeral: 'finalizado',
      scoreEventos: [{ pagouComMulta: true }, { pagouComMulta: true }],
    });
    assert.equal(pagamentoAtrasado.caixa.saldo, 51500);
    assert.equal(pagamentoAtrasado.cliente.scoreCredito, 0);
    assert.equal(pagamentoAtrasado.cliente.pagamentosEmDia, 0);
    assert.equal(pagamentoAtrasado.cliente.blacklist, true);

    await app.requestOk('/api/clientes', 'POST', {
      id: 'cliente-score-recuperacao',
      nome: 'Cliente Score Recuperacao',
      cpf: '44444444444',
      limite: 100000,
      scoreCredito: 470,
      pagamentosEmDia: 9,
    });
    await app.requestOk('/api/emprestimos', 'POST', {
      id: 'emp-score-recuperacao',
      clienteId: 'cliente-score-recuperacao',
      valorOriginal: 1000,
      taxaJuros: 0,
      valorTotal: 1000,
      parcelas: [{ numero: 1, status: 'pendente', valorBase: 1000 }],
      aprovacao: 'aprovado',
    });
    const pagamentoRecuperacao = await app.requestOk('/api/emprestimos/emp-score-recuperacao/pagar', 'POST', {
      valor: 1000,
      observacao: 'Pagamento em dia fecha ciclo',
      parcelas: [{ numero: 1, status: 'pago', valorPago: 1000 }],
      statusGeral: 'finalizado',
      scoreEventos: [{ pagouComMulta: false }],
    });
    assert.equal(pagamentoRecuperacao.caixa.saldo, 51500);
    assert.equal(pagamentoRecuperacao.cliente.scoreCredito, 500);
    assert.equal(pagamentoRecuperacao.cliente.pagamentosEmDia, 0);
    assert.equal(pagamentoRecuperacao.cliente.blacklist, false);

    const bloqueioManual = await app.requestOk('/api/clientes/cliente-score-recuperacao/blacklist', 'PUT', {
      blocked: true,
      motivo: 'manual',
    });
    assert.equal(bloqueioManual.blacklist, true);
    assert.equal(bloqueioManual.motivoBloqueio, 'manual');

    const desbloqueioManual = await app.requestOk('/api/clientes/cliente-score-recuperacao/blacklist', 'PUT', {
      blocked: false,
    });
    assert.equal(desbloqueioManual.blacklist, false);
    assert.equal(desbloqueioManual.motivoBloqueio, '');
    assert.equal(desbloqueioManual.scoreCredito, 500);

    await app.requestOk('/api/system/reset', 'POST');
    caixa = await app.requestOk('/api/caixa');
    assert.equal(caixa.saldo, 0);

    const stats = await app.requestOk('/api/system/db-stats');
    assert.equal(stats.clientes, 0);
    assert.equal(stats.emprestimos, 0);
    assert.equal(stats.transacoes, 0);

    await app.requestOk('/api/system/state', 'POST', {
      clientes: [{
        id: 'cliente-restaurado',
        nome: 'Cliente Restaurado',
        cpf: '11111111111',
        limite: 50000,
        blacklist: true,
        motivoBloqueio: 'manual',
      }],
      emprestimos: [],
      transacoes: [],
      caixa: {
        saldo: 12345,
        historico: [{
          tipo: 'entrada',
          valor: 12345,
          descricao: 'Saldo restaurado',
          data: '2026-06-15',
          saldoAnterior: 0,
          saldoPosterior: 12345,
        }],
      },
      config: { empresaNome: 'CredGestor' },
      arquivoAprovados: [],
    });

    caixa = await app.requestOk('/api/caixa');
    assert.equal(caixa.saldo, 12345);
    const clientes = await app.requestOk('/api/clientes');
    assert.equal(clientes.pagination.total, 1);
    assert.equal(clientes.data[0].nome, 'Cliente Restaurado');
    assert.equal(clientes.data[0].blacklist, true);
    assert.equal(clientes.data[0].motivoBloqueio, 'manual');
  } finally {
    await app.stop();
    app.cleanup();
  }
});
