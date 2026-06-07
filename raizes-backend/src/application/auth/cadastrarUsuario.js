const bcrypt = require('bcrypt');
const prisma = require('../../infrastructure/prisma/client');
const { AppError } = require('../../domain/errors');

async function cadastrarUsuario({ nome, email, telefone, cpf, senha, aceiteLgpd, aceiteFidelidade }) {
  const emailExistente = await prisma.cliente.findUnique({ where: { email } });
  if (emailExistente) {
    throw new AppError('E-mail já cadastrado.', 409, 'EMAIL_JA_CADASTRADO', [
      { field: 'email', issue: 'Já existe um cadastro com este e-mail.' },
    ]);
  }

  const cpfExistente = await prisma.cliente.findUnique({ where: { cpf } });
  if (cpfExistente) {
    throw new AppError('CPF já cadastrado.', 409, 'CPF_JA_CADASTRADO', [
      { field: 'cpf', issue: 'Já existe um cadastro com este CPF.' },
    ]);
  }

  if (!aceiteLgpd) {
    throw new AppError('O aceite dos termos de privacidade é obrigatório.', 422, 'ACEITE_LGPD_OBRIGATORIO', [
      { field: 'aceiteLgpd', issue: 'Campo obrigatório.' },
    ]);
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const cliente = await prisma.cliente.create({
    data: {
      nome,
      email,
      telefone,
      cpf,
      senhaHash,
      aceiteLgpd,
      aceiteFidelidade: aceiteFidelidade || false,
      pontosCliente: {
        create: {
          saldoAtual: 0,
          totalPedidos: 0,
        },
      },
    },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      aceiteFidelidade: true,
      criadoEm: true,
    },
  });

  return cliente;
}

module.exports = { cadastrarUsuario };
