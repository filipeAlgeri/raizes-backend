const {
  listarUnidades,
  buscarUnidade,
  criarUnidade,
  atualizarUnidade,
} = require('../../application/cardapio/unidadeService');

async function index(req, res, next) {
  try {
    const unidades = await listarUnidades();
    return res.status(200).json(unidades);
  } catch (err) { next(err); }
}

async function show(req, res, next) {
  try {
    const unidade = await buscarUnidade(Number(req.params.id));
    return res.status(200).json(unidade);
  } catch (err) { next(err); }
}

async function store(req, res, next) {
  try {
    const unidade = await criarUnidade(req.body);
    return res.status(201).json(unidade);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const unidade = await atualizarUnidade(Number(req.params.id), req.body);
    return res.status(200).json(unidade);
  } catch (err) { next(err); }
}

module.exports = { index, show, store, update };
