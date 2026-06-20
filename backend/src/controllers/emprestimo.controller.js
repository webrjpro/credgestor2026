const emprestimoService = require('../services/emprestimo.service');
const auditRepository = require('../repositories/audit.repository');
const caixaService = require('../services/caixa.service');

async function listEmprestimos(req, res) {
  try {
    const { page, limit, status, clienteId, cliente_id, orderBy, order } = req.query;
    const tenantId = req.user.tenantId || 'default';
    const result = await emprestimoService.listEmprestimos({
      tenantId,
      status,
      clienteId: clienteId || cliente_id,
      orderBy,
      order,
      page,
      limit,
    });
    return res.json(result);
  } catch (err) {
    console.error('[EMPRESTIMO CONTROLLER] Erro ao listar:', err);
    return res.status(500).json({ error: 'Erro ao listar empréstimos' });
  }
}

async function getEmprestimo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;
    const result = await emprestimoService.getEmprestimo(id, tenantId);
    if (!result) return res.status(404).json({ error: 'Empréstimo não encontrado' });
    return res.json(result);
  } catch (err) {
    console.error('[EMPRESTIMO CONTROLLER] Erro ao buscar:', err);
    return res.status(500).json({ error: 'Erro ao buscar empréstimo' });
  }
}

async function createEmprestimo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const result = await emprestimoService.createEmprestimo(tenantId, req.body);

    auditRepository.insertAuditLog(
      req.user.id,
      'CREATE_EMPRESTIMO',
      { emprestimoId: result.emprestimo.id, valor: result.emprestimo.valorOriginal, clienteId: result.emprestimo.clienteId },
      req.ip,
      tenantId
    );

    return res.status(201).json({
      ...result.emprestimo,
      caixa: result.caixa,
    });
  } catch (err) {
    const mapped = caixaService.mapError(err);
    if (mapped.statusCode >= 500) {
      console.error('[EMPRESTIMO CONTROLLER] Erro ao criar:', err);
      return res.status(500).json({ error: 'Erro ao criar empréstimo' });
    }
    return res.status(mapped.statusCode).json(mapped.body);
  }
}

async function updateEmprestimo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;
    const result = await emprestimoService.updateEmprestimo(id, tenantId, req.body);

    auditRepository.insertAuditLog(
      req.user.id,
      'UPDATE_EMPRESTIMO',
      { emprestimoId: id, changes: Object.keys(req.body) },
      req.ip,
      tenantId
    );

    return res.json({
      ...result.emprestimo,
      caixa: result.caixa,
    });
  } catch (err) {
    const mapped = caixaService.mapError(err);
    if (mapped.statusCode >= 500) {
      console.error('[EMPRESTIMO CONTROLLER] Erro ao atualizar:', err);
      return res.status(500).json({ error: 'Erro ao atualizar empréstimo' });
    }
    return res.status(mapped.statusCode).json(mapped.body);
  }
}

async function deleteEmprestimo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;
    const result = await emprestimoService.deleteEmprestimo(id, tenantId);

    auditRepository.insertAuditLog(
      req.user.id,
      'DELETE_EMPRESTIMO',
      { emprestimoId: id },
      req.ip,
      tenantId
    );

    return res.json({
      success: true,
      caixa: result.caixa,
    });
  } catch (err) {
    const mapped = caixaService.mapError(err);
    if (mapped.statusCode >= 500) {
      console.error('[EMPRESTIMO CONTROLLER] Erro ao excluir:', err);
      return res.status(500).json({ error: 'Erro ao excluir empréstimo' });
    }
    return res.status(mapped.statusCode).json(mapped.body);
  }
}

async function pagarEmprestimo(req, res) {
  try {
    const tenantId = req.user.tenantId || 'default';
    const id = req.params.id;
    const result = await emprestimoService.registrarPagamento(id, tenantId, req.body);

    auditRepository.insertAuditLog(
      req.user.id,
      'PAGAMENTO',
      { emprestimoId: id, valor: req.body.valor, metodo: req.body.metodo },
      req.ip,
      tenantId
    );

    return res.status(201).json({
      success: true,
      transacao_id: result.transacaoId,
      ...result,
    });
  } catch (err) {
    const mapped = caixaService.mapError(err);
    if (mapped.statusCode >= 500) {
      console.error('[EMPRESTIMO CONTROLLER] Erro ao pagar:', err);
      return res.status(500).json({ error: 'Erro ao registrar pagamento' });
    }
    return res.status(mapped.statusCode).json(mapped.body);
  }
}

module.exports = {
  listEmprestimos,
  getEmprestimo,
  createEmprestimo,
  updateEmprestimo,
  deleteEmprestimo,
  pagarEmprestimo,
};
