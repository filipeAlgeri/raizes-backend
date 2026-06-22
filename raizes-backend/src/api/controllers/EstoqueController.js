const estoqueService = require('../../application/estoque/estoqueService');

// GERENTE só pode acessar a própria unidade; ADMIN acessa qualquer uma.
// Retorna true e envia 403 se o acesso for negado.
function _verificarAcessoUnidade(req, res, unidadeId) {
  if (req.usuario.perfil === 'GERENTE' && req.usuario.unidadeId !== unidadeId) {
    res.status(403).json({
      error: 'SEM_PERMISSAO',
      message: 'Você só pode gerenciar a própria unidade.',
      details: [],
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------
// GET /unidades/:unidadeId/estoque
// ---------------------------------------------------------------
async function index(req, res, next) {
  try {
    const unidadeId = Number(req.params.unidadeId);
    if (_verificarAcessoUnidade(req, res, unidadeId)) return;
    const { page, limit } = req.query;

    const resultado = await estoqueService.consultarEstoquePorUnidade(unidadeId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// GET /unidades/:unidadeId/estoque/:itemId
// ---------------------------------------------------------------
async function show(req, res, next) {
  try {
    const unidadeId = Number(req.params.unidadeId);
    if (_verificarAcessoUnidade(req, res, unidadeId)) return;
    const itemId = Number(req.params.itemId);

    const saldo = await estoqueService.consultarSaldoItem(unidadeId, itemId);
    return res.status(200).json(saldo);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// POST /unidades/:unidadeId/estoque/:itemId/entrada
// ---------------------------------------------------------------
async function entrada(req, res, next) {
  try {
    const unidadeId = Number(req.params.unidadeId);
    if (_verificarAcessoUnidade(req, res, unidadeId)) return;
    const itemId = Number(req.params.itemId);
    const { quantidade, motivo } = req.body;

    const realizadoPor = req.usuario
      ? `${req.usuario.tipo}#${req.usuario.sub} (${req.usuario.perfil})`
      : null;

    const resultado = await estoqueService.registrarEntrada({
      unidadeId,
      itemId,
      quantidade: Number(quantidade),
      motivo,
      realizadoPor,
    });

    return res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// POST /unidades/:unidadeId/estoque/:itemId/saida
// ---------------------------------------------------------------
async function saida(req, res, next) {
  try {
    const unidadeId = Number(req.params.unidadeId);
    if (_verificarAcessoUnidade(req, res, unidadeId)) return;
    const itemId = Number(req.params.itemId);
    const { quantidade, motivo } = req.body;

    const realizadoPor = req.usuario
      ? `${req.usuario.tipo}#${req.usuario.sub} (${req.usuario.perfil})`
      : null;

    const resultado = await estoqueService.registrarSaida({
      unidadeId,
      itemId,
      quantidade: Number(quantidade),
      motivo,
      realizadoPor,
    });

    return res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// PATCH /unidades/:unidadeId/estoque/:itemId/ajuste
// ---------------------------------------------------------------
async function ajuste(req, res, next) {
  try {
    const unidadeId = Number(req.params.unidadeId);
    if (_verificarAcessoUnidade(req, res, unidadeId)) return;
    const itemId = Number(req.params.itemId);
    const { novaQuantidade, motivo } = req.body;

    const realizadoPor = req.usuario
      ? `${req.usuario.tipo}#${req.usuario.sub} (${req.usuario.perfil})`
      : null;

    const resultado = await estoqueService.registrarAjuste({
      unidadeId,
      itemId,
      novaQuantidade: Number(novaQuantidade),
      motivo,
      realizadoPor,
    });

    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// GET /unidades/:unidadeId/estoque/movimentacoes
// ---------------------------------------------------------------
async function movimentacoes(req, res, next) {
  try {
    const unidadeId = Number(req.params.unidadeId);
    if (_verificarAcessoUnidade(req, res, unidadeId)) return;
    const { itemId, tipo, page, limit } = req.query;

    const resultado = await estoqueService.listarMovimentacoes(
      unidadeId,
      itemId ? Number(itemId) : undefined,
      {
        tipo,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      }
    );

    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, entrada, saida, ajuste, movimentacoes };
