/**
 * Load Test & Seeding Script for CredGestor
 * Inserts 10,000 clients, 15,000 loan contracts, and 100,000 transactions
 * to measure SQLite performance in WAL mode.
 */
const path = require('path');
const fs = require('fs');
const { initDatabase, getDb, transaction, run, closeDatabase } = require('./database');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'credgestor-api.db');

console.log('=== TESTE DE CARGA & SEED: CREDGESTOR ===');
console.log(`Banco de dados de destino: ${DB_PATH}`);

// Inicializa banco
initDatabase(DB_PATH);
const db = getDb();

function clearDatabase() {
  console.log('Limpando registros de teste anteriores...');
  run("DELETE FROM transacoes WHERE id LIKE 'load_tx_%'");
  run("DELETE FROM emprestimos WHERE id LIKE 'load_emp_%'");
  run("DELETE FROM clientes WHERE id LIKE 'load_cli_%'");
  run("DELETE FROM caixa_historico WHERE id LIKE 'load_ch_%'");
  run("UPDATE caixa SET saldo = 5000000 WHERE tenant_id = 'default'"); // Dá saldo inicial grande para os testes
  console.log('Banco limpo!');
}

function runLoadTest() {
  clearDatabase();

  const numClientes = 10000;
  const numEmprestimos = 15000;
  const numTransacoes = 100000;

  console.log('\n--- Iniciando Geração de Dados em Massa ---');
  console.log(`Meta: ${numClientes.toLocaleString()} clientes, ${numEmprestimos.toLocaleString()} empréstimos, ${numTransacoes.toLocaleString()} transações...`);

  const startTime = Date.now();

  // Prepara statements para máxima performance
  const insertCliente = db.prepare(`
    INSERT INTO clientes (
      id, nome, matricula, cpf, data_nascimento, telefone, email,
      limite, tipo_limite, dia_vencimento, obs, status, data_cadastro,
      score_credito, pagamentos_em_dia, blacklist, contatos, tenant_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      2000, 'total', '10', 'Inserido via teste de carga', 'ativo', '2026-06-14',
      500, 0, 0, '[]', 'default'
    )
  `);

  const insertEmprestimo = db.prepare(`
    INSERT INTO emprestimos (
      id, cliente_id, valor, tipo, taxa, parcelas, parcelas_pagas, valor_parcela,
      data_inicio, data_vencimento, status, historico_pagamentos, obs, plano, tenant_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, 'default'
    )
  `);

  const insertTransacao = db.prepare(`
    INSERT INTO transacoes (
      id, tipo, descricao, valor, data, referencia_id, cliente_nome, tenant_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, 'default'
    )
  `);

  // Executa tudo dentro de UMA única transação SQLite (isso garante velocidade O(1) de descargas de disco no SSD)
  transaction(() => {
    // 1. Inserir Clientes
    console.log('Inserindo clientes...');
    for (let i = 1; i <= numClientes; i++) {
      const id = `load_cli_${i}`;
      const nome = `Cliente de Carga Nº ${i}`;
      const matricula = `MAT-${10000 + i}`;
      const cpf = String(11111111100 + i);
      const dataNasc = '1985-04-12';
      const telefone = '11999999999';
      const email = `cli_${i}@loadtest.com`;

      insertCliente.run(id, nome, matricula, cpf, dataNasc, telefone, email);
    }

    // 2. Inserir Empréstimos
    console.log('Inserindo empréstimos e parcelas...');
    const planoJson = JSON.stringify({
      multaDiaria: 1,
      multaFixa: 5,
      carenciaDias: 5,
      valorTotal: 1200,
      gestorResponsavel: 'Administrador de Carga',
      liberadoPor: null,
      aprovacao: 'aprovado'
    });

    for (let i = 1; i <= numEmprestimos; i++) {
      const empId = `load_emp_${i}`;
      // Distribui os empréstimos entre os clientes cadastrados
      const cliIdx = (i % numClientes) + 1;
      const clienteId = `load_cli_${cliIdx}`;
      const valor = 1000;
      const tipo = i % 2 === 0 ? 'parcelado' : 'avulso';
      const taxa = 20;
      const parcelasCount = tipo === 'parcelado' ? 3 : 1;
      const valorParcela = tipo === 'parcelado' ? 400 : 1200;

      // Parcelas serializadas no historico_pagamentos
      const parcelas = [];
      const statusEmp = i % 3 === 0 ? 'quitado' : 'ativo';
      const parcelasPagas = statusEmp === 'quitado' ? parcelasCount : (i % 2 === 0 ? 1 : 0);

      for (let p = 1; p <= parcelasCount; p++) {
        const pago = p <= parcelasPagas;
        parcelas.push({
          numero: p,
          valorBase: valorParcela,
          vencimento: `2026-07-0${p}`,
          status: pago ? 'pago' : 'pendente',
          dataPagamento: pago ? `2026-07-0${p}T10:00:00Z` : null,
          valorPago: pago ? valorParcela : 0,
          multaPaga: 0
        });
      }

      insertEmprestimo.run(
        empId,
        clienteId,
        valor,
        tipo,
        taxa,
        parcelasCount,
        parcelasPagas,
        valorParcela,
        '2026-06-14',
        '2026-09-14',
        statusEmp,
        JSON.stringify(parcelas),
        'Contrato inserido para teste de volume',
        planoJson
      );
    }

    // 3. Inserir Transações
    console.log('Inserindo transações históricas...');
    for (let i = 1; i <= numTransacoes; i++) {
      const txId = `load_tx_${i}`;
      // Distribui entre depósitos, saídas e recebimentos
      const tipo = i % 3 === 0 ? 'saida' : 'entrada';
      const valor = i % 3 === 0 ? 1000 : 400;
      const desc = tipo === 'entrada' ? `Recebimento de parcela lote ${i}` : `Desembolso de contrato lote ${i}`;
      const data = '2026-06-14';
      const cliIdx = (i % numClientes) + 1;
      const cliNome = `Cliente de Carga Nº ${cliIdx}`;
      const refId = `load_emp_${(i % numEmprestimos) + 1}`;

      insertTransacao.run(txId, tipo, desc, valor, data, refId, cliNome);
    }
  });

  const durationMs = Date.now() - startTime;
  const durationSec = durationMs / 1000;

  console.log('\n==================================================');
  console.log('🎉 TESTE DE CARGA CONCLUÍDO COM SUCESSO!');
  console.log('==================================================');
  console.log(`Tempo total gasto: ${durationSec.toFixed(2)} segundos`);
  console.log(`Velocidade média: ${Math.round((numClientes + numEmprestimos + numTransacoes) / durationSec).toLocaleString()} gravações/segundo`);

  // Estatísticas de arquivo
  const stats = fs.statSync(DB_PATH);
  const sizeMB = stats.size / 1024 / 1024;
  console.log(`Tamanho final do banco em disco: ${sizeMB.toFixed(2)} MB`);

  // Executa uma consulta pesada para testar velocidade de leitura com indexação
  console.log('\nTestando velocidade de leitura indexada...');
  const searchStart = Date.now();
  
  // Faz uma busca reativa com JOIN, ORDER BY e LIMIT como na UI
  const testQuery = db.prepare(`
    SELECT c.nome, e.valor, e.status
    FROM clientes c
    JOIN emprestimos e ON e.cliente_id = c.id
    WHERE c.nome LIKE '%Nº 555%' AND e.status = 'ativo'
    ORDER BY c.nome
    LIMIT 50
  `).all();

  const searchDuration = Date.now() - searchStart;
  console.log(`Resultado da busca rápida: Encontrados ${testQuery.length} registros em ${searchDuration}ms.`);
}

const isCleanOnly = process.argv.includes('--clean');

try {
  if (isCleanOnly) {
    clearDatabase();
    console.log('Limpeza de dados de teste concluída com sucesso!');
  } else {
    runLoadTest();
  }
} catch (err) {
  console.error('Erro fatal no script:', err);
} finally {
  closeDatabase();
}
