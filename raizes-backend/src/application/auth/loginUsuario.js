const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../infrastructure/prisma/client');
const { AppError } = require('../../domain/errors');

function gerarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

async function loginCliente({ email, senha }) {
  const cliente = await prisma.cliente.findUnique({ where: { email } });

  if (!cliente) {
    throw new AppError('E-mail ou senha inválidos.', 401, 'CREDENCIAIS_INVALIDAS');
  }

  const senhaValida = await bcrypt.compare(senha, cliente.senhaHash);
  if (!senhaValida) {
    throw new AppError('E-mail ou senha inválidos.', 401, 'CREDENCIAIS_INVALIDAS');
  }

  const token = gerarToken({
    sub: cliente.id,
    nome: cliente.nome,
    email: cliente.email,
    perfil: 'CLIENTE',
    tipo: 'cliente',
  });

  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    usuario: {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      perfil: 'CLIENTE',
    },
  };
}

async function loginColaborador({ email, senha }) {
  const colaborador = await prisma.colaborador.findUnique({ where: { email } });

  if (!colaborador || !colaborador.ativo) {
    throw new AppError('E-mail ou senha inválidos.', 401, 'CREDENCIAIS_INVALIDAS');
  }

  const senhaValida = await bcrypt.compare(senha, colaborador.senhaHash);
  if (!senhaValida) {
    throw new AppError('E-mail ou senha inválidos.', 401, 'CREDENCIAIS_INVALIDAS');
  }

  const token = gerarToken({
    sub: colaborador.id,
    nome: colaborador.nome,
    email: colaborador.email,
    perfil: colaborador.perfil,
    unidadeId: colaborador.unidadeId,
    tipo: 'colaborador',
  });

  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    usuario: {
      id: colaborador.id,
      nome: colaborador.nome,
      email: colaborador.email,
      perfil: colaborador.perfil,
      unidadeId: colaborador.unidadeId,
    },
  };
}

async function loginCentral({ email, senha }) {
  const usuario = await prisma.usuarioCentral.findUnique({ where: { email } });

  if (!usuario || !usuario.ativo) {
    throw new AppError('E-mail ou senha inválidos.', 401, 'CREDENCIAIS_INVALIDAS');
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    throw new AppError('E-mail ou senha inválidos.', 401, 'CREDENCIAIS_INVALIDAS');
  }

  const token = gerarToken({
    sub: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    setor: usuario.setor,
    tipo: 'central',
  });

  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      setor: usuario.setor,
    },
  };
}

module.exports = { loginCliente, loginColaborador, loginCentral };
