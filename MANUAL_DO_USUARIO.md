# Manual do Usuario - CredGestor 6.0.2

Ultima revisao: 2026-06-20

## O Que E

O CredGestor e um sistema desktop offline para gestao de credito, clientes, caixa, emprestimos, parcelas, inadimplencia, relatorios, recibos e backups.

Os dados ficam no computador onde o programa esta instalado.

## Instalacao

1. Execute `CredGestor-InnoSetup-6.0.2.exe` ou `CredGestor-Setup-6.0.2.exe`.
2. Escolha a pasta de instalacao.
3. Marque os atalhos desejados.
4. Abra o CredGestor pelo atalho criado.

Dados do usuario:

```text
C:\Users\<seu-usuario>\AppData\Roaming\CredGestor
```

## Primeiro Acesso

1. Abra o sistema.
2. Cadastre o primeiro usuario. Ele sera a conta administradora inicial.
3. Guarde a senha em local seguro.

## Fluxo Principal

1. Abra a **Central de Operacoes** para ver o que exige atencao no dia.
2. Cadastre clientes.
3. Configure limites e dados financeiros.
4. Adicione saldo no Caixa.
5. Crie emprestimos.
6. Use a **Esteira de Contratos** para acompanhar analise, aprovacao, arquivo e finalizacao.
7. Registre pagamentos.
8. Acompanhe inadimplencia, Lista de Bloqueados e Recibos.
9. Gere backup local com frequencia.

## Central de Operacoes

A Central de Operacoes fica no menu **Principal**.

Ela mostra em uma unica tela:

- Cobrancas prioritarias.
- Contratos em analise e aprovados.
- Recibos pendentes.
- Risco critico e clientes bloqueados.
- Comparacao entre caixa disponivel e contratos aprovados.

Use essa tela como ponto de partida diario.

## Dashboard Financeiro

O Dashboard mostra uma visao executiva do caixa, capital em rua, retorno previsto, recebido e inadimplencia.

A faixa superior possui atalhos para:

- Central de Operacoes.
- Cobrancas do dia.
- Esteira de Contratos.
- Central de Recibos.

## Usuarios

Em **Gerenciar Usuarios**, uma conta administradora pode criar ou remover usuarios locais.

Use essa tela para separar acesso de gestor, visualizador e administrador.

## Clientes

Em **Clientes**, voce cadastra dados pessoais, contato, renda, limites, banco, PIX e observacoes.

O sistema controla score de credito e bloqueios. Clientes na Lista de Bloqueados nao devem receber novos emprestimos ate desbloqueio.

### Timeline do Cliente

Na tabela de clientes, clique em **Timeline** ou no nome do cliente para abrir o historico completo.

A timeline mostra:

- Cadastro.
- Contratos.
- Pagamentos.
- Atrasos.
- Contatos CRM.
- Bloqueios.
- Score e saldo pendente.

## Caixa

O Caixa representa o dinheiro disponivel para operar.

- Aporte aumenta saldo.
- Emprestimo aprovado debita o principal.
- Pagamento recebido aumenta saldo.
- Estornos sao registrados no historico.

O saldo e calculado pelo backend; a tela apenas mostra o resultado confirmado.

## Emprestimos

Um contrato pode ficar:

- Aprovado.
- Em analise.
- Reprovado.
- Arquivado.
- Finalizado.

Ao aprovar contrato, o sistema verifica se ha saldo suficiente no Caixa.

## Esteira de Contratos

A Esteira de Contratos fica na secao **Aprovacao**.

Ela organiza contratos em colunas:

- Em analise.
- Aprovados.
- Impresso / arquivo.
- Reprovados.
- Finalizados.

Clique em qualquer card da esteira para abrir os detalhes do contrato.

## Pagamentos

Ao registrar pagamento, o sistema atualiza automaticamente:

- Parcelas do contrato.
- Transacao financeira.
- Caixa.
- Score do cliente.
- Lista de Bloqueados, quando o score chega a zero.

## Inadimplencia

Parcelas vencidas aparecem como atraso ou inadimplencia conforme configuracao de carencia e multa.

Pagamentos com multa reduzem score. Pagamentos em dia ajudam na recuperacao do score.

## Lista de Bloqueados

O bloqueio pode ser:

- Automatico: quando o score chega a zero.
- Manual: quando o gestor bloqueia o cliente.

O desbloqueio pode ser feito pela Lista de Bloqueados.

## Recibos e Relatorios

Recibos e relatorios sao gerados localmente. O sistema nao envia recibos para nuvem nem dispara mensagens externas.

### Central de Recibos

A Central de Recibos fica na secao **Aprovacao**.

Filtros disponiveis:

- Pendentes.
- Entregues.
- Estornados.
- Todos.

Use essa tela para marcar recibos como entregues, estornar recibos entregues e abrir o contrato relacionado.

## Busca Global

No topo do sistema, use **Buscar** ou o atalho `Ctrl+K`.

A busca global localiza:

- Clientes por nome, matricula, CPF, telefone ou email.
- Contratos por cliente, ID, status ou CPF.
- Recibos por numero, cliente, CPF ou contrato.

## Backup Local

Faca backup regularmente:

1. Abra Configuracoes.
2. Use as opcoes de backup local ou pendrive.
3. Guarde copia em local seguro.

Backups possuem verificacao de integridade.

## Atualizacao Automatica

Quando instalado pelo pacote update-ready (`CredGestor-Setup-*`), o CredGestor verifica novas versoes ao abrir.

Se existir uma versao nova:

1. O download acontece em segundo plano.
2. O app mostra o progresso no canto inferior.
3. Quando terminar, aparece a opcao para reiniciar.
4. Ao reiniciar, a nova versao e instalada.

Os dados locais, login, clientes, contratos, caixa, recibos e historicos ficam preservados.

## Funciona Sem Internet?

Sim. O CredGestor 6.0.2 foi desenhado para operacao local/offline.

## Onde Ficam Os Dados?

```text
%APPDATA%\CredGestor
```

## Reset Total

Use somente antes de entregar ou quando tiver certeza de que deseja zerar dados locais. O reset total remove clientes, emprestimos, transacoes, caixa, arquivos aprovados e recibos do banco local.

Para confirmar, o sistema abre um modal e exige que voce digite exatamente:

```text
RESETAR
```

O login do gestor fica preservado.
