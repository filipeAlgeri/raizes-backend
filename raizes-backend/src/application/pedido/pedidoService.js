const prisma = require('../../infrastructure/prisma/client');
const {
  AppError,
  RecursoNaoEncontradoError,
  EstoqueInsuficienteError,
  PagamentoJaProcessadoError,
  PagamentoRecusadoError,
} = require('../../domain/errors');
const { processarPagamentoMock } = require('../../infrastructure/mock/pagamentoMockService');
const {
  decrementarEstoqueParaPedido,
  reverterEstoquePorCancelamento,
} = require('../estoque/estoqueService');
const { CANAIS_PRESENCIAIS } = require('./pedido.validation');
const { creditarPontosPorPedido } = require('../fidelidade/fidelidadeService');

// ---------------------------------------------------------------
// Janela de idempotência: 30 segundos
// ---------------------------------------------------------------
const JANELA_IDEMPOTENCIA_MS = 30 * 1000;

// ---------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------

/**
 * Retorna o seletor padrão de pedido para responses públicas.
 * Centraliza o shape para reutilizar em criar, buscar e listar.
 */
function _seletorPedido() {
  return {
    id: true,
    canalPedido: true,
    status: true,
    total: true,
    formaPagamento: true,
    anonimo: true,
    criadoEm: true,
    atualizadoEm: true,
    unidade: { select: { id: true, nome: true, cidade: true } },
    cliente: { select: { id: true, nome: true, email: true } },
    itensPedido: {
      select: {
        id: true,
        quantidade: true,
        precoUnitario: true,
        item: { select: { id: true, nome: true, categoria: true } },
        variacao: { select: { id: true, tamanho: true } },
      },
    },
    pagamento: {
      select: {
        id: true,
        forma: true,
        valor: true,
        status: true,
        transacaoId: true,
        processadoEm: true,
        criadoEm: true,
        // respostaMock é omitido intencionalmente para não expor payload interno
      },
    },
  };
}

/**
 * Verifica se a transição de status é permitida pelas regras de negócio.
 * Diagrama: AGUARDANDO_PAGAMENTO → EM_PREPARO → PRONTO → ENTREGUE
 *           qualquer estado (exceto ENTREGUE) → CANCELADO
 */
function _validarTransicaoStatus(statusAtual, statusNovo) {
  const transicoes = {
    AGUARDANDO_PAGAMENTO: ['EM_PREPARO', 'CANCELADO'],
    EM_PREPARO: ['PRONTO', 'CANCELADO'],
    PRONTO: ['ENTREGUE', 'CANCELADO'],
    ENTREGUE: [],
    CANCELADO: [],
  };

  const permitidos = transicoes[statusAtual] ?? [];

  if (!permitidos.includes(statusNovo)) {
    throw new AppError(
      `Transição de status inválida: ${statusAtual} → ${statusNovo}. Permitidos: ${permitidos.join(', ') || 'nenhum'}.`,
      409,
      'TRANSICAO_STATUS_INVALIDA',
      [{ field: 'status', issue: `De "${statusAtual}" só é possível ir para: ${permitidos.join(', ') || 'nenhum'}.` }]
    );
  }
}

/**
 * Verifica se o colaborador tem permissão sobre a unidade do pedido.
 * ADMIN e perfis centrais visualizam tudo; colaboradores só veem sua unidade.
 */
function _assertAcessoUnidade(usuario, unidadeIdPedido) {
  const perfisGlobais = ['ADMIN', 'FINANCEIRO', 'SUPORTE', 'MARKETING', 'RH_CENTRAL'];
  if (perfisGlobais.includes(usuario.perfil)) return;
  if (usuario.tipo === 'colaborador' && usuario.unidadeId !== unidadeIdPedido) {
    throw new AppError(
      'Acesso negado: este pedido pertence a outra unidade.',
      403,
      'SEM_PERMISSAO'
    );
  }
}

// ---------------------------------------------------------------
// Casos de uso públicos
// ---------------------------------------------------------------

/**
 * Cria um novo pedido com validação completa de estoque e cálculo de total.
 * Implementa janela de idempotência de 30s para evitar pedidos duplicados.
 *
 * Fluxo:
 *  1. Validar unidade e itens
 *  2. Congelar preços (precoUnitario no momento da criação)
 *  3. Verificar idempotência
 *  4. $transaction: decrementar estoque + criar pedido + itens
 *  5. Processar pagamento mock
 *  6. Atualizar status conforme resultado + registrar log
 *  7. Se recusado: reverter estoque (nova transação atômica)
 */
async function criarPedido(dados, usuarioReq) {
  const {
    unidadeId,
    clienteId,
    canalPedido,
    formaPagamento,
    itens,
    voucherCodigo,
    anonimo = false,
  } = dados;

  // --- 1. Unidade existe e está ativa ---
  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
  if (!unidade) throw new RecursoNaoEncontradoError('Unidade');
  if (!unidade.ativa) {
    throw new AppError('Esta unidade não está ativa.', 409, 'UNIDADE_INATIVA', [
      { field: 'unidadeId', issue: 'Unidade desativada.' },
    ]);
  }

  // --- 2. Cliente existe (se informado) ---
  if (clienteId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new RecursoNaoEncontradoError('Cliente');
  }

  // --- 3. Validar e congelar preços dos itens ---
  const itensComPreco = [];
  for (const item of itens) {
    const variacao = await prisma.variacaoItem.findUnique({
      where: { id: item.variacaoId },
      include: {
        item: {
          select: { id: true, nome: true, status: true },
        },
      },
    });

    if (!variacao) {
      throw new AppError(
        `Variação de item não encontrada.`,
        404,
        'RECURSO_NAO_ENCONTRADO',
        [{ field: `itens[variacaoId:${item.variacaoId}]`, issue: 'Variação não encontrada.' }]
      );
    }

    if (variacao.itemId !== item.itemId) {
      throw new AppError(
        'variacaoId não pertence ao itemId informado.',
        422,
        'VARIACAO_ITEM_INCOMPATIVEL',
        [{ field: `itens[itemId:${item.itemId}]`, issue: 'variacaoId incompatível com itemId.' }]
      );
    }

    if (variacao.item.status !== 'APROVADO') {
      throw new AppError(
        `O item "${variacao.item.nome}" não está disponível.`,
        409,
        'ITEM_NAO_DISPONIVEL',
        [{ field: `itens[itemId:${item.itemId}]`, issue: `Status: ${variacao.item.status}` }]
      );
    }

    // Verifica se o item está no cardápio da unidade e disponível
    const cardapio = await prisma.cardapioUnidade.findUnique({
      where: { unidadeId_itemId: { unidadeId, itemId: item.itemId } },
    });

    if (!cardapio || !cardapio.disponivel) {
      throw new AppError(
        `O item "${variacao.item.nome}" não está disponível nesta unidade.`,
        409,
        'ITEM_INDISPONIVEL_NA_UNIDADE',
        [{ field: `itens[itemId:${item.itemId}]`, issue: 'Item não disponível nesta unidade.' }]
      );
    }

    itensComPreco.push({
      itemId: item.itemId,
      variacaoId: item.variacaoId,
      quantidade: item.quantidade,
      precoUnitario: Number(variacao.preco),
    });
  }

  // --- 4. Calcular total ---
  let total = itensComPreco.reduce(
    (acc, i) => acc + i.precoUnitario * i.quantidade,
    0
  );

  // --- 5. Voucher (validação e desconto) ---
  let voucher = null;
  if (voucherCodigo) {
    voucher = await prisma.voucher.findUnique({ where: { codigo: voucherCodigo } });

    if (!voucher) {
      throw new AppError('Voucher não encontrado.', 422, 'VOUCHER_INVALIDO', [
        { field: 'voucherCodigo', issue: 'Código não encontrado.' },
      ]);
    }
    if (voucher.usado) {
      throw new AppError('Este voucher já foi utilizado.', 409, 'VOUCHER_JA_USADO', [
        { field: 'voucherCodigo', issue: 'Voucher já foi utilizado.' },
      ]);
    }
    if (new Date(voucher.validade) < new Date()) {
      throw new AppError('Este voucher está expirado.', 409, 'VOUCHER_EXPIRADO', [
        { field: 'voucherCodigo', issue: 'Voucher fora do prazo de validade.' },
      ]);
    }
    if (voucher.escopo === 'UNIDADE_PROPRIA' && voucher.emitidoPorUnidadeId !== unidadeId) {
      throw new AppError('Este voucher não é válido nesta unidade.', 409, 'VOUCHER_FORA_DO_ESCOPO', [
        { field: 'voucherCodigo', issue: 'Voucher restrito à unidade emissora.' },
      ]);
    }
    if (voucher.escopo === 'UNIDADES_SELECIONADAS') {
      const voucherUnidade = await prisma.voucherUnidade.findUnique({
        where: { voucherId_unidadeId: { voucherId: voucher.id, unidadeId } },
      });
      if (!voucherUnidade) {
        throw new AppError('Este voucher não é válido nesta unidade.', 409, 'VOUCHER_FORA_DO_ESCOPO', [
          { field: 'voucherCodigo', issue: 'Unidade não inclusa no escopo do voucher.' },
        ]);
      }
    }

    const desconto = Number(voucher.valor);
    total = Math.max(0, total - desconto);
  }

  // --- 6. Idempotência: mesmo cliente + unidade + itens nos últimos 30s ---
  if (clienteId) {
    const limiteIdempotencia = new Date(Date.now() - JANELA_IDEMPOTENCIA_MS);
    const pedidoRecente = await prisma.pedido.findFirst({
      where: {
        clienteId,
        unidadeId,
        canalPedido,
        criadoEm: { gte: limiteIdempotencia },
        status: { not: 'CANCELADO' },
      },
      select: _seletorPedido(),
      orderBy: { criadoEm: 'desc' },
    });

    if (pedidoRecente) return pedidoRecente; // retorna pedido existente silenciosamente
  }

  // --- 7. Identificação do ator para rastreabilidade ---
  const realizadoPor = usuarioReq
    ? `${usuarioReq.tipo}#${usuarioReq.sub} (${usuarioReq.perfil})`
    : 'anonimo';

  // --- 8. Transação: estoque + pedido + itens + voucher ---
  const pedidoCriado = await prisma.$transaction(async (tx) => {
    // Decrementa estoque atomicamente
    await decrementarEstoqueParaPedido(
      tx,
      unidadeId,
      itensComPreco.map((i) => ({ itemId: i.itemId, quantidade: i.quantidade })),
      null, // pedidoId ainda não existe
      realizadoPor
    );

    // Cria o pedido
    const novoPedido = await tx.pedido.create({
      data: {
        unidadeId,
        clienteId: clienteId || null,
        canalPedido,
        status: 'AGUARDANDO_PAGAMENTO',
        total,
        formaPagamento,
        anonimo: anonimo || !clienteId,
        itensPedido: {
          create: itensComPreco.map((i) => ({
            itemId: i.itemId,
            variacaoId: i.variacaoId,
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario,
          })),
        },
      },
      select: { id: true, unidadeId: true },
    });

    // Log de criação
    await tx.logPedido.create({
      data: {
        pedidoId: novoPedido.id,
        statusAntes: null,
        statusDepois: 'AGUARDANDO_PAGAMENTO',
        realizadoPor,
      },
    });

    // Marca voucher como usado
    if (voucher) {
      await tx.voucher.update({
        where: { id: voucher.id },
        data: { usado: true },
      });
    }

    return novoPedido;
  });

  // --- 9. Processar pagamento mock ---
  const resultadoPagamento = processarPagamentoMock({
    pedidoId: pedidoCriado.id,
    valor: total,
    formaPagamento,
    clienteId: clienteId || null,
  });

  const pagamentoAprovado = resultadoPagamento.status === 'APROVADO';
  const novoStatus = pagamentoAprovado ? 'EM_PREPARO' : 'CANCELADO';

  // --- 10. Registrar pagamento + atualizar status (transação) ---
  await prisma.$transaction(async (tx) => {
    await tx.pagamento.create({
      data: {
        pedidoId: pedidoCriado.id,
        forma: formaPagamento,
        valor: total,
        status: resultadoPagamento.status,
        transacaoId: resultadoPagamento.transacaoId,
        processadoEm: new Date(resultadoPagamento.processadoEm),
        respostaMock: resultadoPagamento,
      },
    });

    await tx.pedido.update({
      where: { id: pedidoCriado.id },
      data: { status: novoStatus },
    });

    await tx.logPedido.create({
      data: {
        pedidoId: pedidoCriado.id,
        statusAntes: 'AGUARDANDO_PAGAMENTO',
        statusDepois: novoStatus,
        realizadoPor: 'sistema/pagamento-mock',
      },
    });

    // Se recusado: reverter estoque na mesma transação
    if (!pagamentoAprovado) {
      await reverterEstoquePorCancelamento(
        tx,
        unidadeId,
        itensComPreco.map((i) => ({ itemId: i.itemId, quantidade: i.quantidade })),
        pedidoCriado.id,
        'sistema/cancelamento-pagamento-recusado'
      );
    }
  });

  // --- 11. Retornar pedido completo com shape final ---
  const pedidoFinal = await prisma.pedido.findUnique({
    where: { id: pedidoCriado.id },
    select: _seletorPedido(),
  });

  // Agrega o resultado do pagamento no response (sem expor respostaMock interna)
  return {
    ...pedidoFinal,
    pagamentoResultado: {
      status: resultadoPagamento.status,
      mensagem: resultadoPagamento.mensagem,
      transacaoId: resultadoPagamento.transacaoId,
    },
  };
}

/**
 * Lista pedidos com filtros: unidade, status, canal, cliente, data.
 * Paginado.
 */
async function listarPedidos({
  unidadeId,
  status,
  canalPedido,
  clienteId,
  dataInicio,
  dataFim,
  page = 1,
  limit = 20,
} = {}) {
  const skip = (page - 1) * limit;
  const where = {};

  if (unidadeId) where.unidadeId = Number(unidadeId);
  if (status) where.status = status;
  if (canalPedido) where.canalPedido = canalPedido;
  if (clienteId) where.clienteId = Number(clienteId);
  if (dataInicio || dataFim) {
    where.criadoEm = {};
    if (dataInicio) where.criadoEm.gte = new Date(dataInicio);
    if (dataFim) where.criadoEm.lte = new Date(dataFim);
  }

  const [pedidos, total] = await Promise.all([
    prisma.pedido.findMany({
      where,
      skip,
      take: Number(limit),
      select: _seletorPedido(),
      orderBy: { criadoEm: 'desc' },
    }),
    prisma.pedido.count({ where }),
  ]);

  return {
    data: pedidos,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Busca um pedido pelo ID.
 */
async function buscarPedido(id, usuarioReq) {
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: _seletorPedido(),
  });

  if (!pedido) throw new RecursoNaoEncontradoError('Pedido');

  _assertAcessoUnidade(usuarioReq, pedido.unidade.id);

  return pedido;
}

/**
 * Atualiza o status de um pedido manualmente (cozinha/gerente/atendente).
 * Valida transição de estados e registra log de auditoria.
 */
async function atualizarStatus(id, novoStatus, usuarioReq, motivo) {
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: { id: true, status: true, unidadeId: true },
  });

  if (!pedido) throw new RecursoNaoEncontradoError('Pedido');

  _assertAcessoUnidade(usuarioReq, pedido.unidadeId);
  _validarTransicaoStatus(pedido.status, novoStatus);

  const realizadoPor = usuarioReq
    ? `${usuarioReq.tipo}#${usuarioReq.sub} (${usuarioReq.perfil})`
    : 'sistema';

  const pedidoAtualizado = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.pedido.update({
      where: { id },
      data: { status: novoStatus },
      select: _seletorPedido(),
    });

    await tx.logPedido.create({
      data: {
        pedidoId: id,
        statusAntes: pedido.status,
        statusDepois: novoStatus,
        realizadoPor,
      },
    });

    // Credita pontos quando pedido é entregue (cliente não anônimo + aderiu ao programa)
    if (novoStatus === 'ENTREGUE') {
      const pedidoCompleto = await tx.pedido.findUnique({
        where: { id },
        select: { clienteId: true, anonimo: true, total: true,
                  cliente: { select: { aceiteFidelidade: true } } },
      });

      if (
        pedidoCompleto.clienteId &&
        !pedidoCompleto.anonimo &&
        pedidoCompleto.cliente?.aceiteFidelidade
      ) {
        await creditarPontosPorPedido(tx, {
          clienteId: pedidoCompleto.clienteId,
          pedidoId: id,
          totalPedido: pedidoCompleto.total,
        });
      }
    }

    return atualizado;
  });

  return pedidoAtualizado;
}

/**
 * Cancela um pedido. Reverte estoque se ainda estava em preparo.
 * Apenas GERENTE, ADMIN ou o próprio CLIENTE podem cancelar.
 */
async function cancelarPedido(id, usuarioReq, motivo) {
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      unidadeId: true,
      clienteId: true,
      itensPedido: {
        select: { itemId: true, quantidade: true },
      },
    },
  });

  if (!pedido) throw new RecursoNaoEncontradoError('Pedido');

  // Cliente só pode cancelar o próprio pedido
  if (
    usuarioReq.perfil === 'CLIENTE' &&
    pedido.clienteId !== usuarioReq.sub
  ) {
    throw new AppError('Você não tem permissão para cancelar este pedido.', 403, 'SEM_PERMISSAO');
  }

  _validarTransicaoStatus(pedido.status, 'CANCELADO');

  const realizadoPor = usuarioReq
    ? `${usuarioReq.tipo}#${usuarioReq.sub} (${usuarioReq.perfil})`
    : 'sistema';

  const precisaReverterEstoque = ['EM_PREPARO', 'PRONTO'].includes(pedido.status);

  const pedidoCancelado = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.pedido.update({
      where: { id },
      data: { status: 'CANCELADO' },
      select: _seletorPedido(),
    });

    await tx.logPedido.create({
      data: {
        pedidoId: id,
        statusAntes: pedido.status,
        statusDepois: 'CANCELADO',
        realizadoPor,
      },
    });

    if (precisaReverterEstoque) {
      await reverterEstoquePorCancelamento(
        tx,
        pedido.unidadeId,
        pedido.itensPedido,
        id,
        realizadoPor
      );
    }

    return atualizado;
  });

  return pedidoCancelado;
}

/**
 * Retorna os logs de auditoria de um pedido.
 */
async function listarLogsPedido(id, usuarioReq) {
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: { id: true, unidadeId: true },
  });

  if (!pedido) throw new RecursoNaoEncontradoError('Pedido');

  _assertAcessoUnidade(usuarioReq, pedido.unidadeId);

  return prisma.logPedido.findMany({
    where: { pedidoId: id },
    select: {
      id: true,
      statusAntes: true,
      statusDepois: true,
      realizadoPor: true,
      criadoEm: true,
    },
    orderBy: { criadoEm: 'asc' },
  });
}

module.exports = {
  criarPedido,
  listarPedidos,
  buscarPedido,
  atualizarStatus,
  cancelarPedido,
  listarLogsPedido,
};
