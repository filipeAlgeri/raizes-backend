const express = require('express');
const router = express.Router();
const { authMiddleware, autorizar } = require('../middlewares/auth.middleware');
const PedidoController = require('../controllers/PedidoController');

/**
 * @swagger
 * tags:
 *   name: Pedidos
 *   description: Criação, consulta, atualização de status e cancelamento de pedidos
 */

// ---------------------------------------------------------------
// Perfis por operação
// ---------------------------------------------------------------
// Criação: cliente, atendente (balcão), sistema (totem/web sem login)
const CRIAR = ['CLIENTE', 'ATENDENTE', 'GERENTE', 'ADMIN'];
// Listagem: todos os colaboradores da unidade + perfis centrais + cliente (próprios)
const LISTAR = ['ADMIN', 'FINANCEIRO', 'SUPORTE', 'MARKETING', 'RH_CENTRAL', 'GERENTE', 'ATENDENTE', 'COZINHA', 'CLIENTE'];
// Atualização de status: cozinha confirma preparo/pronto/entrega; gerente tem poder total
const ATUALIZAR_STATUS = ['GERENTE', 'ATENDENTE', 'COZINHA', 'ADMIN'];
// Cancelamento: cliente (próprio pedido), gerente, admin
const CANCELAR = ['CLIENTE', 'GERENTE', 'ADMIN'];
// Logs: auditoria — gerentes e perfis centrais
const VER_LOGS = ['ADMIN', 'FINANCEIRO', 'SUPORTE', 'GERENTE'];

/**
 * @swagger
 * /pedidos:
 *   post:
 *     summary: Cria um novo pedido
 *     description: |
 *       Valida estoque, congela preços, processa pagamento mock e retorna o pedido
 *       com o resultado do pagamento. Implementa janela de idempotência de 30s
 *       (mesmo cliente + unidade + canal → retorna pedido recente se existir).
 *
 *       **Nota sobre `clienteId`:** para o perfil `CLIENTE`, o valor informado no
 *       body é ignorado — o sistema sempre usa o cliente autenticado no token JWT.
 *       Apenas operadores (ATENDENTE, GERENTE, ADMIN) podem especificar `clienteId`
 *       para criar pedidos em nome de terceiros (ex.: pedido balcão).
 *     tags: [Pedidos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unidadeId
 *               - canalPedido
 *               - formaPagamento
 *               - itens
 *             properties:
 *               unidadeId:
 *                 type: integer
 *                 example: 1
 *               clienteId:
 *                 type: integer
 *                 nullable: true
 *                 example: 5
 *               canalPedido:
 *                 type: string
 *                 enum: [APP, WEB, TOTEM, BALCAO, PICKUP]
 *                 example: TOTEM
 *               formaPagamento:
 *                 type: string
 *                 enum: [PIX, CARTAO_CREDITO, CARTAO_DEBITO, VOUCHER, DINHEIRO, MOCK]
 *                 example: MOCK
 *               itens:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [itemId, variacaoId, quantidade]
 *                   properties:
 *                     itemId:
 *                       type: integer
 *                       example: 3
 *                     variacaoId:
 *                       type: integer
 *                       example: 5
 *                     quantidade:
 *                       type: integer
 *                       minimum: 1
 *                       example: 2
 *               voucherCodigo:
 *                 type: string
 *                 example: "DESC20"
 *               anonimo:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Pedido criado e pagamento processado
 *         content:
 *           application/json:
 *             example:
 *               id: 42
 *               canalPedido: "TOTEM"
 *               status: "EM_PREPARO"
 *               total: 51.80
 *               formaPagamento: "MOCK"
 *               anonimo: false
 *               criadoEm: "2026-05-21T12:00:00Z"
 *               atualizadoEm: "2026-05-21T12:00:01Z"
 *               unidade:
 *                 id: 1
 *                 nome: "Raízes Fortaleza Centro"
 *                 cidade: "Fortaleza"
 *               cliente:
 *                 id: 5
 *                 nome: "Maria Silva"
 *                 email: "maria@teste.com"
 *               itensPedido:
 *                 - id: 80
 *                   quantidade: 2
 *                   precoUnitario: 25.90
 *                   item:
 *                     id: 3
 *                     nome: "X-Burguer"
 *                     categoria: "LANCHE"
 *                   variacao:
 *                     id: 5
 *                     tamanho: "M"
 *               pagamento:
 *                 id: 30
 *                 forma: "MOCK"
 *                 valor: 51.80
 *                 status: "APROVADO"
 *                 transacaoId: "MOCK-1716292800000-42"
 *                 processadoEm: "2026-05-21T12:00:01Z"
 *               pagamentoResultado:
 *                 status: "APROVADO"
 *                 mensagem: "Pagamento aprovado com sucesso."
 *                 transacaoId: "MOCK-1716292800000-42"
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         description: Unidade, cliente ou item não encontrado
 *         content:
 *           application/json:
 *             example:
 *               error: "RECURSO_NAO_ENCONTRADO"
 *               message: "Unidade não encontrada."
 *               details: []
 *               timestamp: "2026-05-21T12:00:00Z"
 *               path: "/pedidos"
 *       409:
 *         description: Conflito — estoque insuficiente, unidade inativa ou item indisponível
 *         content:
 *           application/json:
 *             examples:
 *               estoqueInsuficiente:
 *                 summary: Estoque insuficiente
 *                 value:
 *                   error: "ESTOQUE_INSUFICIENTE"
 *                   message: "Não há quantidade suficiente para um ou mais itens."
 *                   details:
 *                     - field: "itens[itemId:3].quantidade"
 *                       issue: "Saldo disponível: 1. Solicitado: 2."
 *                   timestamp: "2026-05-21T12:00:00Z"
 *                   path: "/pedidos"
 *               pagamentoRecusado:
 *                 summary: Pedido criado mas pagamento recusado (status CANCELADO)
 *                 value:
 *                   id: 43
 *                   status: "CANCELADO"
 *                   pagamentoResultado:
 *                     status: "RECUSADO"
 *                     mensagem: "Pagamento recusado. Verifique os dados e tente novamente."
 *                     transacaoId: null
 *       422:
 *         description: Dados inválidos (campos obrigatórios, canalPedido inválido, etc.)
 *         content:
 *           application/json:
 *             example:
 *               error: "DADOS_INVALIDOS"
 *               message: "Requisição inválida. Verifique os campos."
 *               details:
 *                 - field: "canalPedido"
 *                   issue: "canalPedido inválido. Valores aceitos: APP, WEB, TOTEM, BALCAO, PICKUP."
 *               timestamp: "2026-05-21T12:00:00Z"
 *               path: "/pedidos"
 */
router.post('/', authMiddleware, autorizar(...CRIAR), PedidoController.store);

/**
 * @swagger
 * /pedidos:
 *   get:
 *     summary: Lista pedidos com filtros
 *     description: |
 *       Colaboradores veem apenas pedidos da própria unidade.
 *       Perfis centrais (ADMIN, FINANCEIRO, SUPORTE) veem todos.
 *       Clientes veem apenas os próprios pedidos (filtrado automaticamente).
 *     tags: [Pedidos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unidadeId
 *         schema:
 *           type: integer
 *         description: Filtrar por unidade (perfis centrais apenas)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AGUARDANDO_PAGAMENTO, EM_PREPARO, PRONTO, ENTREGUE, CANCELADO]
 *       - in: query
 *         name: canalPedido
 *         schema:
 *           type: string
 *           enum: [APP, WEB, TOTEM, BALCAO, PICKUP]
 *         description: Filtrar por canal de origem do pedido
 *       - in: query
 *         name: clienteId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: dataInicio
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2026-05-01T00:00:00Z"
 *       - in: query
 *         name: dataFim
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2026-05-31T23:59:59Z"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista paginada de pedidos
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 - id: 42
 *                   canalPedido: "TOTEM"
 *                   status: "EM_PREPARO"
 *                   total: 51.80
 *                   formaPagamento: "MOCK"
 *                   criadoEm: "2026-05-21T12:00:00Z"
 *               meta:
 *                 total: 1
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 1
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 */
router.get('/', authMiddleware, autorizar(...LISTAR), PedidoController.index);

/**
 * @swagger
 * /pedidos/{id}:
 *   get:
 *     summary: Busca um pedido pelo ID
 *     tags: [Pedidos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.get('/:id', authMiddleware, autorizar(...LISTAR), PedidoController.show);

/**
 * @swagger
 * /pedidos/{id}/status:
 *   patch:
 *     summary: Atualiza o status de um pedido
 *     description: |
 *       Transições válidas:
 *       - AGUARDANDO_PAGAMENTO → EM_PREPARO | CANCELADO
 *       - EM_PREPARO → PRONTO | CANCELADO
 *       - PRONTO → ENTREGUE | CANCELADO
 *       - ENTREGUE e CANCELADO são estados finais (sem transição).
 *     tags: [Pedidos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [EM_PREPARO, PRONTO, ENTREGUE, CANCELADO]
 *                 example: "PRONTO"
 *               motivo:
 *                 type: string
 *                 example: "Pedido finalizado pela cozinha"
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       409:
 *         description: Transição de status inválida
 *         content:
 *           application/json:
 *             example:
 *               error: "TRANSICAO_STATUS_INVALIDA"
 *               message: "Transição de status inválida: ENTREGUE → PRONTO. Permitidos: nenhum."
 *               details:
 *                 - field: "status"
 *                   issue: "De \"ENTREGUE\" só é possível ir para: nenhum."
 *               timestamp: "2026-05-21T13:00:00Z"
 *               path: "/pedidos/42/status"
 *       422:
 *         $ref: '#/components/responses/ErroValidacao'
 */
router.patch('/:id/status', authMiddleware, autorizar(...ATUALIZAR_STATUS), PedidoController.atualizarStatus);

/**
 * @swagger
 * /pedidos/{id}/cancelar:
 *   delete:
 *     summary: Cancela um pedido
 *     description: |
 *       Reverte estoque automaticamente se o pedido estava EM_PREPARO ou PRONTO.
 *       Clientes só podem cancelar os próprios pedidos.
 *     tags: [Pedidos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *                 example: "Cliente desistiu do pedido"
 *     responses:
 *       200:
 *         description: Pedido cancelado com sucesso
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       409:
 *         description: Pedido já entregue ou já cancelado
 *         content:
 *           application/json:
 *             example:
 *               error: "TRANSICAO_STATUS_INVALIDA"
 *               message: "Transição de status inválida: ENTREGUE → CANCELADO. Permitidos: nenhum."
 *               details:
 *                 - field: "status"
 *                   issue: "De \"ENTREGUE\" só é possível ir para: nenhum."
 *               timestamp: "2026-05-21T13:00:00Z"
 *               path: "/pedidos/42/cancelar"
 */
router.delete('/:id/cancelar', authMiddleware, autorizar(...CANCELAR), PedidoController.cancelar);

/**
 * @swagger
 * /pedidos/{id}/logs:
 *   get:
 *     summary: Lista o histórico de auditoria (logs) de um pedido
 *     description: Retorna todas as transições de status com timestamp e responsável.
 *     tags: [Pedidos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Logs do pedido
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 statusAntes: null
 *                 statusDepois: "AGUARDANDO_PAGAMENTO"
 *                 realizadoPor: "cliente#5 (CLIENTE)"
 *                 criadoEm: "2026-05-21T12:00:00Z"
 *               - id: 2
 *                 statusAntes: "AGUARDANDO_PAGAMENTO"
 *                 statusDepois: "EM_PREPARO"
 *                 realizadoPor: "sistema/pagamento-mock"
 *                 criadoEm: "2026-05-21T12:00:01Z"
 *               - id: 3
 *                 statusAntes: "EM_PREPARO"
 *                 statusDepois: "PRONTO"
 *                 realizadoPor: "colaborador#3 (COZINHA)"
 *                 criadoEm: "2026-05-21T12:15:00Z"
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.get('/:id/logs', authMiddleware, autorizar(...VER_LOGS), PedidoController.logs);

module.exports = router;
