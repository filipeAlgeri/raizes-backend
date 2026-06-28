/**
 * Cliente Prisma exclusivo para operações de limpeza nos testes.
 * Nunca contém lógica de negócio — só operações de cleanup.
 *
 * A DATABASE_URL já foi sobrescrita por loadEnv.js antes de este módulo
 * ser importado, então este client aponta para raizes_db_test.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Deleta uma lista de pedidos e TODAS as suas dependências na ordem certa
 * para não violar FK constraints:
 *
 *   notificacao → historicoPontos → logPedido → pagamento → itemPedido → pedido
 */
async function deletarPedidos(pedidoIds) {
  if (!pedidoIds || pedidoIds.length === 0) return;

  await prisma.$transaction([
    prisma.notificacao.deleteMany({ where: { pedidoId: { in: pedidoIds } } }),
    prisma.historicoPontos.deleteMany({ where: { pedidoId: { in: pedidoIds } } }),
    prisma.logPedido.deleteMany({ where: { pedidoId: { in: pedidoIds } } }),
    prisma.pagamento.deleteMany({ where: { pedidoId: { in: pedidoIds } } }),
    prisma.itemPedido.deleteMany({ where: { pedidoId: { in: pedidoIds } } }),
    prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } }),
  ]);
}

/**
 * Deleta um cliente criado durante testes (e suas dependências diretas).
 * Usado em auth.test.js para limpar clientes de registro.
 */
async function deletarClientePorEmail(email) {
  const cliente = await prisma.cliente.findUnique({ where: { email } });
  if (!cliente) return;

  // Ordem: remove dependências antes do cliente pai
  await prisma.historicoPontos.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.pontosCliente.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.notificacao.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
}

/**
 * Zera o programa de fidelidade de um cliente sem deletar o registro de PontosCliente.
 * Usado em fidelidade.test.js para garantir estado limpo entre execuções.
 */
async function resetarPontosCliente(clienteId) {
  await prisma.historicoPontos.deleteMany({ where: { clienteId } });
  await prisma.pontosCliente.updateMany({
    where: { clienteId },
    data: { saldoAtual: 0, totalPedidos: 0 },
  });
}

module.exports = { prisma, deletarPedidos, deletarClientePorEmail, resetarPontosCliente };
