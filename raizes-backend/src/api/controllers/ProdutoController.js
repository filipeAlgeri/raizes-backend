const {
  listarProdutos,
  buscarProduto,
  criarProduto,
  atualizarProduto,
  removerProduto,
  aprovarSugestao,
  negarSugestao,
  listarSugestoes,
  criarSugestao,
  configurarCardapioUnidade,
} = require('../../application/cardapio/produtoService');

async function index(req, res, next) {
  try {
    const { page, limit, unidadeId, categoria, status } = req.query;
    const resultado = await listarProdutos({ page, limit, unidadeId, categoria, status });
    return res.status(200).json(resultado);
  } catch (err) { next(err); }
}

async function show(req, res, next) {
  try {
    const produto = await buscarProduto(Number(req.params.id));
    return res.status(200).json(produto);
  } catch (err) { next(err); }
}

async function store(req, res, next) {
  try {
    const criadoPorUnidadeId = req.usuario.tipo === 'colaborador'
      ? req.usuario.unidadeId
      : null;
    const produto = await criarProduto({ ...req.body, criadoPorUnidadeId });
    return res.status(201).json(produto);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const produto = await atualizarProduto(Number(req.params.id), req.body);
    return res.status(200).json(produto);
  } catch (err) { next(err); }
}

async function destroy(req, res, next) {
  try {
    await removerProduto(Number(req.params.id));
    return res.status(204).send();
  } catch (err) { next(err); }
}

async function indexSugestoes(req, res, next) {
  try {
    const { status, unidadeId } = req.query;
    const sugestoes = await listarSugestoes({ status, unidadeId });
    return res.status(200).json(sugestoes);
  } catch (err) { next(err); }
}

async function storeSugestao(req, res, next) {
  try {
    const sugestao = await criarSugestao({
      ...req.body,
      unidadeId: req.usuario.unidadeId,
      colaboradorId: req.usuario.sub,
    });
    return res.status(201).json(sugestao);
  } catch (err) { next(err); }
}

async function aprovar(req, res, next) {
  try {
    const sugestao = await aprovarSugestao(Number(req.params.id));
    return res.status(200).json(sugestao);
  } catch (err) { next(err); }
}

async function negar(req, res, next) {
  try {
    const { respostaAdmin } = req.body;
    const sugestao = await negarSugestao(Number(req.params.id), respostaAdmin);
    return res.status(200).json(sugestao);
  } catch (err) { next(err); }
}

async function configurarCardapio(req, res, next) {
  try {
    const unidadeId = Number(req.params.unidadeId);

    // GERENTE só pode configurar o cardápio da própria unidade
    if (req.usuario.perfil === 'GERENTE' && req.usuario.unidadeId !== unidadeId) {
      return res.status(403).json({
        error: 'SEM_PERMISSAO',
        message: 'Você só pode gerenciar o cardápio da própria unidade.',
        details: [],
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    const resultado = await configurarCardapioUnidade({ ...req.body, unidadeId });
    return res.status(200).json(resultado);
  } catch (err) { next(err); }
}

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
  indexSugestoes,
  storeSugestao,
  aprovar,
  negar,
  configurarCardapio,
};
