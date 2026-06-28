const prisma = require('../../infrastructure/prisma/client');
const { AppError, RecursoNaoEncontradoError } = require('../../domain/errors');
const {
  calcularPontosGanhos,
  calcularEquivalenteEmReais,
  calcularProximoBonus,
  calcularResgate,
  BONUS_A_CADA_PEDIDOS,
  BONUS_QUANTIDADE,
} = require('./fidelidade.calculos');

// ---------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------

/**
 * Busca o cliente e valida que ele existe e aderiu ao programa.
 */
async function _assertClienteFidelidade(clienteId) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, email: true, aceiteFidelidade: true, aceiteLgpd: true },
  });

  if (!cliente) throw new RecursoNaoEncontradoError('Cliente');

  if (!cliente.aceiteFidelidade) {
    throw new AppError(
      'Cliente não aderiu ao programa de fidelidade.',
      409,
      'FIDELIDADE_NAO_ACEITA',
      [{ field: 'clienteId', issue: 'O campo aceiteFidelidade deve ser true para participar.' }]
    );
  }

  return cliente;
}

/**
 * Busca ou cria o registro de PontosCliente de forma segura dentro de uma tx.
 */
async function _obterOuCriarPontosCliente(tx, clienteId) {
  const existente = await tx.pontosCliente.findUnique({ where: { clienteId } });
  if (existente) return existente;

  return tx.pontosCliente.create({
    data: { clienteId, saldoAtual: 0, totalPedidos: 0 },
  });
}

// ---------------------------------------------------------------
// Casos de uso públicos
// ---------------------------------------------------------------

/**
 * Retorna o saldo atual, total de pedidos e os últimos registros
 * do histórico de pontos do cliente.
 */
async function consultarSaldo(clienteId) {
  await _assertClienteFidelidade(clienteId);

  const pontos = await prisma.pontosCliente.findUnique({
    where: { clienteId },
    select: {
      id: true,
      saldoAtual: true,
      totalPedidos: true,
      cliente: { select: { id: true, nome: true, email: true } },
    },
  });

  // Cliente ainda não tem registro — retorna saldo zero
  if (!pontos) {
    return {
      saldoAtual: 0,
      totalPedidos: 0,
      clienteId,
      equivalenteEmReais: 0,
      proximoBonusEm: BONUS_A_CADA_PEDIDOS,
    };
  }

  return {
    ...pontos,
    equivalenteEmReais: calcularEquivalenteEmReais(pontos.saldoAtual),
    proximoBonusEm: calcularProximoBonus(pontos.totalPedidos),
  };
}

/**
 * Lista o histórico de pontos com paginação e filtro por tipo.
 */
async function listarHistorico(clienteId, { tipo, page = 1, limit = 20 } = {}) {
  await _assertClienteFidelidade(clienteId);

  const where = { clienteId };
  if (tipo) where.tipo = tipo;

  const skip = (page - 1) * limit;

  const [registros, total] = await Promise.all([
    prisma.historicoPontos.findMany({
      where,
      skip,
      take: Number(limit),
      select: {
        id: true,
        tipo: true,
        quantidade: true,
        descricao: true,
        criadoEm: true,
        pedido: { select: { id: true, status: true, total: true, criadoEm: true } },
      },
      orderBy: { criadoEm: 'desc' },
    }),
    prisma.historicoPontos.count({ where }),
  ]);

  return {
    data: registros,
    meta: {
      clienteId,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Credita pontos ao cliente quando um pedido é marcado como ENTREGUE.
 * Regra: R$1 = 1 ponto. Verifica bônus a cada 5 pedidos.
 * Deve ser chamado pelo módulo de Pedidos ao transitar para ENTREGUE.
 *
 * Operação idempotente: verifica se já existe crédito para este pedidoId
 * antes de inserir, para evitar duplo crédito em caso de retentativa.
 *
 * @param {object} tx - Transação Prisma já aberta pelo caller.
 */
async function creditarPontosPorPedido(tx, { clienteId, pedidoId, totalPedido }) {
  // Idempotência: não creditar duas vezes o mesmo pedido
  const jaCredita = await tx.historicoPontos.findFirst({
    where: { clienteId, pedidoId, tipo: 'GANHO' },
  });
  if (jaCredita) return null;

  const pontosGanhos = calcularPontosGanhos(totalPedido);
  if (pontosGanhos <= 0) return null;

  const registro = await _obterOuCriarPontosCliente(tx, clienteId);

  const novoSaldo = registro.saldoAtual + pontosGanhos;
  const novoTotalPedidos = registro.totalPedidos + 1;

  // Atualiza saldo e contador de pedidos
  const pontosAtualizado = await tx.pontosCliente.update({
    where: { clienteId },
    data: { saldoAtual: novoSaldo, totalPedidos: novoTotalPedidos },
  });

  // Registra no histórico
  await tx.historicoPontos.create({
    data: {
      clienteId,
      pedidoId,
      pontosClienteId: registro.id,
      tipo: 'GANHO',
      quantidade: pontosGanhos,
      descricao: `Pedido #${pedidoId} — R$${Number(totalPedido).toFixed(2)}`,
    },
  });

  // Verifica se atingiu múltiplo de 5 pedidos → bônus
  let bonusRegistrado = null;
  if (novoTotalPedidos % BONUS_A_CADA_PEDIDOS === 0) {
    const saldoComBonus = novoSaldo + BONUS_QUANTIDADE;

    await tx.pontosCliente.update({
      where: { clienteId },
      data: { saldoAtual: saldoComBonus },
    });

    bonusRegistrado = await tx.historicoPontos.create({
      data: {
        clienteId,
        pedidoId,
        pontosClienteId: registro.id,
        tipo: 'BONUS_PEDIDOS',
        quantidade: BONUS_QUANTIDADE,
        descricao: `Bônus por ${novoTotalPedidos} pedidos concluídos`,
      },
      select: { id: true, tipo: true, quantidade: true, descricao: true, criadoEm: true },
    });
  }

  return {
    pontosGanhos,
    bonus: bonusRegistrado,
    saldoAtualizado: bonusRegistrado
      ? novoSaldo + BONUS_QUANTIDADE
      : novoSaldo,
  };
}

/**
 * Resgata pontos do cliente em troca de desconto.
 *
 * O cliente opta por resgatar todos os pontos disponíveis:
 * - Desconto parcial: pontos cobrem menos que totalCompra → todos os pontos são usados.
 * - Desconto total:   pontos cobrem totalCompra ou mais   → usa-se só o necessário,
 *                     o restante permanece acumulado.
 *
 * Taxa de conversão: VALOR_RESGATE reais a cada PONTOS_PARA_RESGATAR pontos.
 *
 * @param {number} totalCompra - Valor total da compra em R$.
 */
async function resgatarPontos(clienteId, totalCompra) {
  await _assertClienteFidelidade(clienteId);

  const totalCompraNum = Number(totalCompra);
  if (!totalCompra || isNaN(totalCompraNum) || totalCompraNum <= 0) {
    throw new AppError(
      'totalCompra deve ser um número positivo.',
      422,
      'DADOS_INVALIDOS',
      [{ field: 'totalCompra', issue: 'Deve ser um valor positivo.' }]
    );
  }

  return prisma.$transaction(async (tx) => {
    const registro = await tx.pontosCliente.findUnique({ where: { clienteId } });
    const saldoAtual = registro?.saldoAtual ?? 0;

    if (!registro || saldoAtual <= 0) {
      throw new AppError(
        `Saldo insuficiente para resgate. Disponível: ${saldoAtual} pts.`,
        409,
        'SALDO_INSUFICIENTE',
        [{ field: 'clienteId', issue: `Saldo disponível: ${saldoAtual} pts.` }]
      );
    }

    const { valorDesconto, pontosUsados } = calcularResgate(saldoAtual, totalCompraNum);

    const novoSaldo = saldoAtual - pontosUsados;

    await tx.pontosCliente.update({
      where: { clienteId },
      data: { saldoAtual: novoSaldo },
    });

    const historico = await tx.historicoPontos.create({
      data: {
        clienteId,
        pontosClienteId: registro.id,
        tipo: 'RESGATE',
        quantidade: -pontosUsados,
        descricao: `Resgate de ${pontosUsados} pts — desconto de R$${valorDesconto.toFixed(2)}`,
      },
      select: {
        id: true, tipo: true, quantidade: true, descricao: true, criadoEm: true,
      },
    });

    return {
      pontosUsados,
      valorDesconto,
      saldoAnterior: saldoAtual,
      saldoAtual: novoSaldo,
      historico,
    };
  });
}

/**
 * Estorna pontos (ex.: cancelamento de pedido após crédito).
 * Deve ser chamado pelo módulo de Pedidos quando um pedido ENTREGUE
 * for revertido por decisão administrativa.
 *
 * @param {object} tx - Transação Prisma já aberta pelo caller.
 */
async function estornarPontos(tx, { clienteId, pedidoId, motivo }) {
  // Localiza o crédito original para saber quantos pontos estornar
  const creditoOriginal = await tx.historicoPontos.findFirst({
    where: { clienteId, pedidoId, tipo: 'GANHO' },
    select: { id: true, quantidade: true, pontosClienteId: true },
  });

  if (!creditoOriginal) return null; // nada a estornar

  const registro = await tx.pontosCliente.findUnique({ where: { clienteId } });
  if (!registro) return null;

  const novoSaldo = Math.max(0, registro.saldoAtual - creditoOriginal.quantidade);

  await tx.pontosCliente.update({
    where: { clienteId },
    data: { saldoAtual: novoSaldo, totalPedidos: Math.max(0, registro.totalPedidos - 1) },
  });

  return tx.historicoPontos.create({
    data: {
      clienteId,
      pedidoId,
      pontosClienteId: registro.id,
      tipo: 'ESTORNO',
      quantidade: -creditoOriginal.quantidade,
      descricao: motivo || `Estorno — pedido #${pedidoId}`,
    },
    select: { id: true, tipo: true, quantidade: true, descricao: true, criadoEm: true },
  });
}

module.exports = {
  consultarSaldo,
  listarHistorico,
  creditarPontosPorPedido,
  resgatarPontos,
  estornarPontos,
};
