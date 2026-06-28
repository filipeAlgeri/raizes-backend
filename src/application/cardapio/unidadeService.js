const prisma = require('../../infrastructure/prisma/client');
const { AppError, RecursoNaoEncontradoError } = require('../../domain/errors');

async function listarUnidades() {
  return prisma.unidade.findMany({
    where: { ativa: true },
    select: {
      id: true,
      nome: true,
      cidade: true,
      estado: true,
      endereco: true,
      telefone: true,
    },
    orderBy: { nome: 'asc' },
  });
}

async function buscarUnidade(id) {
  const unidade = await prisma.unidade.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      cnpj: true,
      cidade: true,
      estado: true,
      endereco: true,
      telefone: true,
      ativa: true,
    },
  });

  if (!unidade) throw new RecursoNaoEncontradoError('Unidade');
  return unidade;
}

async function criarUnidade({ nome, cnpj, cidade, estado, endereco, telefone }) {
  const existente = await prisma.unidade.findUnique({ where: { cnpj } });
  if (existente) {
    throw new AppError('CNPJ já cadastrado.', 409, 'CNPJ_JA_CADASTRADO', [
      { field: 'cnpj', issue: 'Já existe uma unidade com este CNPJ.' },
    ]);
  }

  return prisma.unidade.create({
    data: { nome, cnpj, cidade, estado, endereco, telefone },
    select: { id: true, nome: true, cidade: true, estado: true, ativa: true },
  });
}

async function atualizarUnidade(id, dados) {
  await buscarUnidade(id);
  return prisma.unidade.update({
    where: { id },
    data: dados,
    select: { id: true, nome: true, cidade: true, estado: true, ativa: true },
  });
}

module.exports = { listarUnidades, buscarUnidade, criarUnidade, atualizarUnidade };
