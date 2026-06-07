const prisma = require('../../infrastructure/prisma/client');
const { AppError, RecursoNaoEncontradoError } = require('../../domain/errors');

async function listarProdutos({ page = 1, limit = 10, unidadeId, categoria, status }) {
  const skip = (page - 1) * limit;

  const where = {};

  if (status) where.status = status;
  else where.status = 'APROVADO';

  if (categoria) where.categoria = categoria;

  if (unidadeId) {
    where.cardapioUnidade = {
      some: {
        unidadeId: Number(unidadeId),
        disponivel: true,
      },
    };
  }

  const [itens, total] = await Promise.all([
    prisma.itemCardapio.findMany({
      where,
      skip,
      take: Number(limit),
      select: {
        id: true,
        nome: true,
        descricao: true,
        categoria: true,
        status: true,
        variacoes: {
          select: { id: true, tamanho: true, preco: true },
          orderBy: { preco: 'asc' },
        },
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.itemCardapio.count({ where }),
  ]);

  return {
    data: itens,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function buscarProduto(id) {
  const item = await prisma.itemCardapio.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      descricao: true,
      categoria: true,
      status: true,
      criadoEm: true,
      variacoes: {
        select: { id: true, tamanho: true, preco: true },
        orderBy: { preco: 'asc' },
      },
    },
  });

  if (!item) throw new RecursoNaoEncontradoError('Produto');
  return item;
}

async function criarProduto({ nome, descricao, categoria, variacoes, criadoPorUnidadeId }) {
  if (!variacoes || variacoes.length === 0) {
    throw new AppError('O produto deve ter ao menos uma variação de tamanho e preço.', 422, 'VARIACOES_OBRIGATORIAS', [
      { field: 'variacoes', issue: 'Campo obrigatório com ao menos um item.' },
    ]);
  }

  return prisma.itemCardapio.create({
    data: {
      nome,
      descricao,
      categoria,
      status: criadoPorUnidadeId ? 'PENDENTE' : 'APROVADO',
      criadoPorUnidadeId,
      variacoes: {
        create: variacoes.map((v) => ({ tamanho: v.tamanho, preco: v.preco })),
      },
    },
    select: {
      id: true,
      nome: true,
      categoria: true,
      status: true,
      variacoes: { select: { id: true, tamanho: true, preco: true } },
    },
  });
}

async function atualizarProduto(id, { nome, descricao, categoria, variacoes }) {
  await buscarProduto(id);

  return prisma.$transaction(async (tx) => {
    if (variacoes && variacoes.length > 0) {
      await tx.variacaoItem.deleteMany({ where: { itemId: id } });
      await tx.variacaoItem.createMany({
        data: variacoes.map((v) => ({ itemId: id, tamanho: v.tamanho, preco: v.preco })),
      });
    }

    return tx.itemCardapio.update({
      where: { id },
      data: { nome, descricao, categoria },
      select: {
        id: true,
        nome: true,
        categoria: true,
        status: true,
        variacoes: { select: { id: true, tamanho: true, preco: true } },
      },
    });
  });
}

async function removerProduto(id) {
  await buscarProduto(id);
  await prisma.itemCardapio.update({
    where: { id },
    data: { status: 'REJEITADO' },
  });
}

async function aprovarSugestao(id) {
  const sugestao = await prisma.sugestaoItem.findUnique({ where: { id } });
  if (!sugestao) throw new RecursoNaoEncontradoError('Sugestão');

  if (sugestao.status !== 'PENDENTE') {
    throw new AppError('Sugestão já foi processada.', 409, 'SUGESTAO_JA_PROCESSADA');
  }

  return prisma.sugestaoItem.update({
    where: { id },
    data: { status: 'APROVADA' },
  });
}

async function negarSugestao(id, respostaAdmin) {
  const sugestao = await prisma.sugestaoItem.findUnique({ where: { id } });
  if (!sugestao) throw new RecursoNaoEncontradoError('Sugestão');

  if (sugestao.status !== 'PENDENTE') {
    throw new AppError('Sugestão já foi processada.', 409, 'SUGESTAO_JA_PROCESSADA');
  }

  return prisma.sugestaoItem.update({
    where: { id },
    data: { status: 'REJEITADA', respostaAdmin },
  });
}

async function listarSugestoes({ status, unidadeId }) {
  const where = {};
  if (status) where.status = status;
  if (unidadeId) where.unidadeId = Number(unidadeId);

  return prisma.sugestaoItem.findMany({
    where,
    select: {
      id: true,
      nome: true,
      descricao: true,
      status: true,
      respostaAdmin: true,
      criadoEm: true,
      unidade: { select: { id: true, nome: true } },
      colaborador: { select: { id: true, nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
  });
}

async function criarSugestao({ unidadeId, colaboradorId, nome, descricao }) {
  return prisma.sugestaoItem.create({
    data: { unidadeId, colaboradorId, nome, descricao },
    select: { id: true, nome: true, status: true, criadoEm: true },
  });
}

async function configurarCardapioUnidade({ unidadeId, itemId, disponivel }) {
  const cardapio = await prisma.cardapioUnidade.upsert({
    where: { unidadeId_itemId: { unidadeId, itemId } },
    update: { disponivel },
    create: { unidadeId, itemId, disponivel },
  });
  return cardapio;
}

module.exports = {
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
};
