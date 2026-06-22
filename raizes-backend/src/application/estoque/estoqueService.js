const prisma = require('../../infrastructure/prisma/client');
const { EstoqueInsuficienteError, RecursoNaoEncontradoError, AppError } = require('../../domain/errors');

// ---------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------

/**
 * Garante que a unidade existe. Lança 404 se não existir.
 */
async function _assertUnidadeExiste(unidadeId) {
  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
  if (!unidade) throw new RecursoNaoEncontradoError('Unidade');
  return unidade;
}

/**
 * Garante que o item de cardápio existe e está aprovado.
 */
async function _assertItemExiste(itemId) {
  const item = await prisma.itemCardapio.findUnique({ where: { id: itemId } });
  if (!item) throw new RecursoNaoEncontradoError('Item do cardápio');
  if (item.status !== 'APROVADO') {
    throw new AppError('Item do cardápio não está aprovado.', 422, 'ITEM_NAO_APROVADO', [
      { field: 'itemId', issue: `Status atual: ${item.status}` },
    ]);
  }
  return item;
}

/**
 * Busca (ou cria com saldo zero) o registro de estoque de um item numa unidade.
 * Retorna o registro com lock para uso em transações.
 */
async function _obterOuCriarEstoque(tx, unidadeId, itemId) {
  const registroExistente = await tx.estoque.findUnique({
    where: { unidadeId_itemId: { unidadeId, itemId } },
  });

  if (registroExistente) return registroExistente;

  return tx.estoque.create({
    data: { unidadeId, itemId, quantidade: 0 },
  });
}

// ---------------------------------------------------------------
// Casos de uso públicos
// ---------------------------------------------------------------

/**
 * Consulta o saldo de estoque de uma unidade com paginação.
 * Perfis permitidos: ADMIN, GERENTE (própria unidade), SUPORTE.
 */
async function consultarEstoquePorUnidade(unidadeId, { page = 1, limit = 20 } = {}) {
  await _assertUnidadeExiste(unidadeId);

  const skip = (page - 1) * limit;

  const [registros, total] = await Promise.all([
    prisma.estoque.findMany({
      where: { unidadeId },
      skip,
      take: Number(limit),
      select: {
        id: true,
        quantidade: true,
        atualizadoEm: true,
        item: {
          select: {
            id: true,
            nome: true,
            categoria: true,
            status: true,
            variacoes: { select: { id: true, tamanho: true, preco: true } },
          },
        },
      },
      orderBy: { item: { nome: 'asc' } },
    }),
    prisma.estoque.count({ where: { unidadeId } }),
  ]);

  return {
    data: registros,
    meta: {
      unidadeId,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Consulta o saldo de um item específico em uma unidade.
 */
async function consultarSaldoItem(unidadeId, itemId) {
  await _assertUnidadeExiste(unidadeId);
  await _assertItemExiste(itemId);

  const registro = await prisma.estoque.findUnique({
    where: { unidadeId_itemId: { unidadeId, itemId } },
    select: {
      id: true,
      quantidade: true,
      atualizadoEm: true,
      item: {
        select: {
          id: true,
          nome: true,
          categoria: true,
          variacoes: { select: { id: true, tamanho: true, preco: true } },
        },
      },
    },
  });

  if (!registro) {
    return { id: null, quantidade: 0, itemId, unidadeId, atualizadoEm: null, item: null };
  }

  return registro;
}

/**
 * Registra uma ENTRADA de estoque (reabastecimento).
 * Perfis permitidos: GERENTE (própria unidade).
 */
async function registrarEntrada({ unidadeId, itemId, quantidade, motivo, realizadoPor }) {
  if (!quantidade || quantidade <= 0) {
    throw new AppError('A quantidade deve ser um número inteiro positivo.', 422, 'QUANTIDADE_INVALIDA', [
      { field: 'quantidade', issue: 'Deve ser maior que zero.' },
    ]);
  }

  await _assertUnidadeExiste(unidadeId);
  await _assertItemExiste(itemId);

  return prisma.$transaction(async (tx) => {
    const registro = await _obterOuCriarEstoque(tx, unidadeId, itemId);
    const quantidadeAnterior = registro.quantidade;
    const quantidadeResultante = quantidadeAnterior + quantidade;

    const estoqueAtualizado = await tx.estoque.update({
      where: { id: registro.id },
      data: { quantidade: quantidadeResultante },
      select: { id: true, quantidade: true, atualizadoEm: true },
    });

    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        estoqueId: registro.id,
        unidadeId,
        itemId,
        tipo: 'ENTRADA',
        quantidade,
        quantidadeAnterior,
        quantidadeResultante,
        motivo: motivo || 'Entrada de estoque',
        realizadoPor: realizadoPor || null,
      },
      select: {
        id: true, tipo: true, quantidade: true,
        quantidadeAnterior: true, quantidadeResultante: true,
        motivo: true, realizadoPor: true, criadoEm: true,
      },
    });

    return {
      estoque: estoqueAtualizado,
      movimentacao,
    };
  });
}

/**
 * Registra uma SAÍDA manual de estoque (descarte, perda, etc.).
 * Perfis permitidos: GERENTE (própria unidade).
 * Lança EstoqueInsuficienteError se saldo < quantidade solicitada.
 */
async function registrarSaida({ unidadeId, itemId, quantidade, motivo, realizadoPor }) {
  if (!quantidade || quantidade <= 0) {
    throw new AppError('A quantidade deve ser um número inteiro positivo.', 422, 'QUANTIDADE_INVALIDA', [
      { field: 'quantidade', issue: 'Deve ser maior que zero.' },
    ]);
  }

  await _assertUnidadeExiste(unidadeId);
  await _assertItemExiste(itemId);

  return prisma.$transaction(async (tx) => {
    const registro = await _obterOuCriarEstoque(tx, unidadeId, itemId);
    const quantidadeAnterior = registro.quantidade;

    if (quantidadeAnterior < quantidade) {
      throw new EstoqueInsuficienteError([
        {
          field: 'quantidade',
          issue: `Saldo disponível: ${quantidadeAnterior}. Solicitado: ${quantidade}.`,
        },
      ]);
    }

    const quantidadeResultante = quantidadeAnterior - quantidade;

    const estoqueAtualizado = await tx.estoque.update({
      where: { id: registro.id },
      data: { quantidade: quantidadeResultante },
      select: { id: true, quantidade: true, atualizadoEm: true },
    });

    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        estoqueId: registro.id,
        unidadeId,
        itemId,
        tipo: 'SAIDA',
        quantidade,
        quantidadeAnterior,
        quantidadeResultante,
        motivo: motivo || 'Saída de estoque',
        realizadoPor: realizadoPor || null,
      },
      select: {
        id: true, tipo: true, quantidade: true,
        quantidadeAnterior: true, quantidadeResultante: true,
        motivo: true, realizadoPor: true, criadoEm: true,
      },
    });

    return {
      estoque: estoqueAtualizado,
      movimentacao,
    };
  });
}

/**
 * Registra um AJUSTE de estoque (correção de inventário).
 * Aceita qualquer valor não-negativo, incluindo zero (zerar o saldo).
 * Perfis permitidos: GERENTE (própria unidade).
 */
async function registrarAjuste({ unidadeId, itemId, novaQuantidade, motivo, realizadoPor }) {
  if (novaQuantidade === undefined || novaQuantidade === null || novaQuantidade < 0) {
    throw new AppError('novaQuantidade deve ser um inteiro maior ou igual a zero.', 422, 'QUANTIDADE_INVALIDA', [
      { field: 'novaQuantidade', issue: 'Deve ser >= 0.' },
    ]);
  }

  await _assertUnidadeExiste(unidadeId);
  await _assertItemExiste(itemId);

  return prisma.$transaction(async (tx) => {
    const registro = await _obterOuCriarEstoque(tx, unidadeId, itemId);
    const quantidadeAnterior = registro.quantidade;
    const diferenca = Math.abs(novaQuantidade - quantidadeAnterior);

    const estoqueAtualizado = await tx.estoque.update({
      where: { id: registro.id },
      data: { quantidade: novaQuantidade },
      select: { id: true, quantidade: true, atualizadoEm: true },
    });

    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        estoqueId: registro.id,
        unidadeId,
        itemId,
        tipo: 'AJUSTE',
        quantidade: diferenca,
        quantidadeAnterior,
        quantidadeResultante: novaQuantidade,
        motivo: motivo || 'Ajuste de inventário',
        realizadoPor: realizadoPor || null,
      },
      select: {
        id: true, tipo: true, quantidade: true,
        quantidadeAnterior: true, quantidadeResultante: true,
        motivo: true, realizadoPor: true, criadoEm: true,
      },
    });

    return {
      estoque: estoqueAtualizado,
      movimentacao,
    };
  });
}

/**
 * Lista o histórico de movimentações de um item numa unidade,
 * com filtro opcional por tipo e paginação.
 */
async function listarMovimentacoes(unidadeId, itemId, { tipo, page = 1, limit = 20 } = {}) {
  await _assertUnidadeExiste(unidadeId);

  const where = { unidadeId };
  if (itemId) where.itemId = Number(itemId);
  if (tipo) where.tipo = tipo;

  const skip = (page - 1) * limit;

  const [movimentacoes, total] = await Promise.all([
    prisma.movimentacaoEstoque.findMany({
      where,
      skip,
      take: Number(limit),
      select: {
        id: true,
        tipo: true,
        quantidade: true,
        quantidadeAnterior: true,
        quantidadeResultante: true,
        motivo: true,
        realizadoPor: true,
        pedidoId: true,
        criadoEm: true,
        estoque: {
          select: {
            item: { select: { id: true, nome: true, categoria: true } },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
    }),
    prisma.movimentacaoEstoque.count({ where }),
  ]);

  return {
    data: movimentacoes,
    meta: {
      unidadeId,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------
// Utilitário reutilizável pelo módulo de Pedidos
// ---------------------------------------------------------------

/**
 * Decrementa o estoque de múltiplos itens de um pedido dentro de uma
 * transação Prisma já aberta. Lança EstoqueInsuficienteError se
 * qualquer item não tiver saldo suficiente.
 *
 * @param {object} tx - Instância de transação Prisma ($transaction callback).
 * @param {number} unidadeId
 * @param {Array<{itemId: number, quantidade: number}>} itens
 * @param {number|null} pedidoId - ID do pedido para rastreabilidade (pode ser null na criação).
 * @param {string|null} realizadoPor - Identificação do ator (ex: "pedido#123 / clienteId:5")
 */
async function decrementarEstoqueParaPedido(tx, unidadeId, itens, pedidoId = null, realizadoPor = null) {
  for (const { itemId, quantidade } of itens) {
    const registro = await tx.estoque.findUnique({
      where: { unidadeId_itemId: { unidadeId, itemId } },
    });

    const saldoAtual = registro ? registro.quantidade : 0;

    if (saldoAtual < quantidade) {
      throw new EstoqueInsuficienteError([
        {
          field: `itens[itemId:${itemId}].quantidade`,
          issue: `Saldo disponível: ${saldoAtual}. Solicitado: ${quantidade}.`,
        },
      ]);
    }

    const quantidadeResultante = saldoAtual - quantidade;

    // Decremento condicional atômico: o banco só aplica o UPDATE se quantidade >= solicitado
    // no momento do lock de linha, eliminando a condição de corrida sob carga concorrente.
    // updateMany não aceita o atalho unidadeId_itemId — usa campos individuais.
    const resultado = await tx.estoque.updateMany({
      where: { unidadeId, itemId, quantidade: { gte: quantidade } },
      data: { quantidade: { decrement: quantidade } },
    });

    if (resultado.count === 0) {
      throw new EstoqueInsuficienteError([
        {
          field: `itens[itemId:${itemId}].quantidade`,
          issue: `Estoque insuficiente (modificado por requisição concorrente). Tente novamente.`,
        },
      ]);
    }

    await tx.movimentacaoEstoque.create({
      data: {
        estoqueId: registro.id,
        unidadeId,
        itemId,
        tipo: 'SAIDA',
        quantidade,
        quantidadeAnterior: saldoAtual,
        quantidadeResultante,
        motivo: `Venda — pedido #${pedidoId ?? 'pendente'}`,
        realizadoPor,
        pedidoId,
      },
    });
  }
}

/**
 * Reverte o estoque de múltiplos itens após cancelamento de pedido.
 * Deve ser chamado dentro da mesma transação do cancelamento.
 */
async function reverterEstoquePorCancelamento(tx, unidadeId, itens, pedidoId, realizadoPor = null) {
  for (const { itemId, quantidade } of itens) {
    const registro = await tx.estoque.findUnique({
      where: { unidadeId_itemId: { unidadeId, itemId } },
    });

    const saldoAtual = registro ? registro.quantidade : 0;
    const quantidadeResultante = saldoAtual + quantidade;

    const estoqueAtualizado = await tx.estoque.upsert({
      where: { unidadeId_itemId: { unidadeId, itemId } },
      update: { quantidade: quantidadeResultante },
      create: { unidadeId, itemId, quantidade: quantidadeResultante },
    });

    await tx.movimentacaoEstoque.create({
      data: {
        estoqueId: estoqueAtualizado.id,
        unidadeId,
        itemId,
        tipo: 'ENTRADA',
        quantidade,
        quantidadeAnterior: saldoAtual,
        quantidadeResultante,
        motivo: `Estorno — cancelamento pedido #${pedidoId}`,
        realizadoPor,
        pedidoId,
      },
    });
  }
}

module.exports = {
  consultarEstoquePorUnidade,
  consultarSaldoItem,
  registrarEntrada,
  registrarSaida,
  registrarAjuste,
  listarMovimentacoes,
  decrementarEstoqueParaPedido,
  reverterEstoquePorCancelamento,
};
