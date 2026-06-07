const pedidoService = require('../../application/pedido/pedidoService');
const {
  criarPedidoSchema,
  atualizarStatusSchema,
  formatarErrosZod,
} = require('../../application/pedido/pedido.validation');
const { AppError } = require('../../domain/errors');

// ---------------------------------------------------------------
// POST /pedidos
// ---------------------------------------------------------------
async function store(req, res, next) {
  try {
    const parse = criarPedidoSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: 'DADOS_INVALIDOS',
        message: 'Requisição inválida. Verifique os campos.',
        details: formatarErrosZod(parse.error),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    const pedido = await pedidoService.criarPedido(parse.data, req.usuario);
    return res.status(201).json(pedido);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// GET /pedidos
// ---------------------------------------------------------------
async function index(req, res, next) {
  try {
    const { unidadeId, status, canalPedido, clienteId, dataInicio, dataFim, page, limit } =
      req.query;

    // Colaboradores só veem pedidos da própria unidade
    const perfisGlobais = ['ADMIN', 'FINANCEIRO', 'SUPORTE', 'MARKETING', 'RH_CENTRAL'];
    const filtroUnidade =
      perfisGlobais.includes(req.usuario.perfil)
        ? unidadeId
        : req.usuario.unidadeId;

    const resultado = await pedidoService.listarPedidos({
      unidadeId: filtroUnidade ? Number(filtroUnidade) : undefined,
      status,
      canalPedido,
      clienteId: clienteId ? Number(clienteId) : undefined,
      dataInicio,
      dataFim,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// GET /pedidos/:id
// ---------------------------------------------------------------
async function show(req, res, next) {
  try {
    const pedido = await pedidoService.buscarPedido(Number(req.params.id), req.usuario);
    return res.status(200).json(pedido);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// PATCH /pedidos/:id/status
// ---------------------------------------------------------------
async function atualizarStatus(req, res, next) {
  try {
    const parse = atualizarStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: 'DADOS_INVALIDOS',
        message: 'Status inválido.',
        details: formatarErrosZod(parse.error),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    const pedido = await pedidoService.atualizarStatus(
      Number(req.params.id),
      parse.data.status,
      req.usuario,
      parse.data.motivo
    );

    return res.status(200).json(pedido);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// DELETE /pedidos/:id  (cancelamento)
// ---------------------------------------------------------------
async function cancelar(req, res, next) {
  try {
    const { motivo } = req.body || {};
    const pedido = await pedidoService.cancelarPedido(
      Number(req.params.id),
      req.usuario,
      motivo
    );
    return res.status(200).json(pedido);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// GET /pedidos/:id/logs
// ---------------------------------------------------------------
async function logs(req, res, next) {
  try {
    const registros = await pedidoService.listarLogsPedido(
      Number(req.params.id),
      req.usuario
    );
    return res.status(200).json(registros);
  } catch (err) {
    next(err);
  }
}

module.exports = { store, index, show, atualizarStatus, cancelar, logs };
