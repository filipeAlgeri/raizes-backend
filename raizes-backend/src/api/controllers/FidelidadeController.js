const fidelidadeService = require('../../application/fidelidade/fidelidadeService');
const { AppError } = require('../../domain/errors');

// ---------------------------------------------------------------
// GET /fidelidade/:clienteId/saldo
// ---------------------------------------------------------------
async function saldo(req, res, next) {
  try {
    const clienteId = Number(req.params.clienteId);

    // Cliente só pode consultar o próprio saldo
    if (req.usuario.perfil === 'CLIENTE' && req.usuario.sub !== clienteId) {
      return res.status(403).json({
        error: 'SEM_PERMISSAO',
        message: 'Você só pode consultar o próprio saldo de pontos.',
        details: [],
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    const resultado = await fidelidadeService.consultarSaldo(clienteId);
    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// GET /fidelidade/:clienteId/historico
// ---------------------------------------------------------------
async function historico(req, res, next) {
  try {
    const clienteId = Number(req.params.clienteId);

    if (req.usuario.perfil === 'CLIENTE' && req.usuario.sub !== clienteId) {
      return res.status(403).json({
        error: 'SEM_PERMISSAO',
        message: 'Você só pode consultar o próprio histórico de pontos.',
        details: [],
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    const { tipo, page, limit } = req.query;

    const resultado = await fidelidadeService.listarHistorico(clienteId, {
      tipo,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// POST /fidelidade/:clienteId/resgatar
// ---------------------------------------------------------------
async function resgatar(req, res, next) {
  try {
    const clienteId = Number(req.params.clienteId);

    // Cliente só pode resgatar os próprios pontos
    if (req.usuario.perfil === 'CLIENTE' && req.usuario.sub !== clienteId) {
      return res.status(403).json({
        error: 'SEM_PERMISSAO',
        message: 'Você só pode resgatar os próprios pontos.',
        details: [],
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    const { qtdBlocos } = req.body;

    if (qtdBlocos === undefined || qtdBlocos === null) {
      return res.status(422).json({
        error: 'DADOS_INVALIDOS',
        message: 'O campo qtdBlocos é obrigatório.',
        details: [{ field: 'qtdBlocos', issue: 'Campo obrigatório.' }],
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    const resultado = await fidelidadeService.resgatarPontos(clienteId, Number(qtdBlocos));
    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = { saldo, historico, resgatar };
