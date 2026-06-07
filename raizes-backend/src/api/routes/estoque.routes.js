const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: herda :unidadeId do router pai
const { authMiddleware, autorizar } = require('../middlewares/auth.middleware');
const EstoqueController = require('../controllers/EstoqueController');

// Perfis com acesso de leitura ao estoque
const LEITURA = ['ADMIN', 'FINANCEIRO', 'SUPORTE', 'GERENTE'];
// Apenas o gerente da unidade movimenta estoque manualmente
const ESCRITA = ['ADMIN', 'GERENTE'];

/**
 * @swagger
 * tags:
 *   name: Estoque
 *   description: Gerenciamento de estoque por unidade (saldo, entradas, saídas, ajustes e histórico)
 */

/**
 * @swagger
 * /unidades/{unidadeId}/estoque:
 *   get:
 *     summary: Lista o saldo de estoque de todos os itens de uma unidade
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unidadeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da unidade
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
 *         description: Lista paginada de saldos de estoque
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 - id: 1
 *                   quantidade: 50
 *                   atualizadoEm: "2026-05-21T10:00:00Z"
 *                   item:
 *                     id: 3
 *                     nome: "X-Burguer"
 *                     categoria: "LANCHE"
 *                     status: "APROVADO"
 *                     variacoes:
 *                       - id: 5
 *                         tamanho: "M"
 *                         preco: 25.90
 *               meta:
 *                 unidadeId: 1
 *                 total: 1
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 1
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.get('/', authMiddleware, autorizar(...LEITURA), EstoqueController.index);

/**
 * @swagger
 * /unidades/{unidadeId}/estoque/movimentacoes:
 *   get:
 *     summary: Lista o histórico de movimentações de estoque de uma unidade
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unidadeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: integer
 *         description: Filtra por item específico
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [ENTRADA, SAIDA, AJUSTE]
 *         description: Filtra por tipo de movimentação
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
 *         description: Histórico paginado de movimentações
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 - id: 10
 *                   tipo: "ENTRADA"
 *                   quantidade: 30
 *                   quantidadeAnterior: 20
 *                   quantidadeResultante: 50
 *                   motivo: "Reabastecimento semanal"
 *                   realizadoPor: "colaborador#2 (GERENTE)"
 *                   pedidoId: null
 *                   criadoEm: "2026-05-21T08:00:00Z"
 *                   estoque:
 *                     item:
 *                       id: 3
 *                       nome: "X-Burguer"
 *                       categoria: "LANCHE"
 *               meta:
 *                 unidadeId: 1
 *                 total: 1
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 1
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.get('/movimentacoes', authMiddleware, autorizar(...LEITURA), EstoqueController.movimentacoes);

/**
 * @swagger
 * /unidades/{unidadeId}/estoque/{itemId}:
 *   get:
 *     summary: Consulta o saldo de um item específico em uma unidade
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unidadeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Saldo do item na unidade
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               quantidade: 50
 *               atualizadoEm: "2026-05-21T10:00:00Z"
 *               item:
 *                 id: 3
 *                 nome: "X-Burguer"
 *                 categoria: "LANCHE"
 *                 variacoes:
 *                   - id: 5
 *                     tamanho: "M"
 *                     preco: 25.90
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.get('/:itemId', authMiddleware, autorizar(...LEITURA), EstoqueController.show);

/**
 * @swagger
 * /unidades/{unidadeId}/estoque/{itemId}/entrada:
 *   post:
 *     summary: Registra uma entrada (reabastecimento) de estoque
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unidadeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: itemId
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
 *               - quantidade
 *             properties:
 *               quantidade:
 *                 type: integer
 *                 minimum: 1
 *                 example: 30
 *               motivo:
 *                 type: string
 *                 example: "Reabastecimento semanal"
 *     responses:
 *       201:
 *         description: Entrada registrada com sucesso
 *         content:
 *           application/json:
 *             example:
 *               estoque:
 *                 id: 1
 *                 quantidade: 80
 *                 atualizadoEm: "2026-05-21T12:00:00Z"
 *               movimentacao:
 *                 id: 15
 *                 tipo: "ENTRADA"
 *                 quantidade: 30
 *                 quantidadeAnterior: 50
 *                 quantidadeResultante: 80
 *                 motivo: "Reabastecimento semanal"
 *                 realizadoPor: "colaborador#2 (GERENTE)"
 *                 criadoEm: "2026-05-21T12:00:00Z"
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       422:
 *         description: Quantidade inválida
 *         content:
 *           application/json:
 *             example:
 *               error: "QUANTIDADE_INVALIDA"
 *               message: "A quantidade deve ser um número inteiro positivo."
 *               details:
 *                 - field: "quantidade"
 *                   issue: "Deve ser maior que zero."
 *               timestamp: "2026-05-21T12:00:00Z"
 *               path: "/unidades/1/estoque/3/entrada"
 */
router.post('/:itemId/entrada', authMiddleware, autorizar(...ESCRITA), EstoqueController.entrada);

/**
 * @swagger
 * /unidades/{unidadeId}/estoque/{itemId}/saida:
 *   post:
 *     summary: Registra uma saída manual de estoque (descarte, perda, etc.)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unidadeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: itemId
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
 *               - quantidade
 *             properties:
 *               quantidade:
 *                 type: integer
 *                 minimum: 1
 *                 example: 5
 *               motivo:
 *                 type: string
 *                 example: "Descarte por validade vencida"
 *     responses:
 *       201:
 *         description: Saída registrada com sucesso
 *         content:
 *           application/json:
 *             example:
 *               estoque:
 *                 id: 1
 *                 quantidade: 45
 *                 atualizadoEm: "2026-05-21T13:00:00Z"
 *               movimentacao:
 *                 id: 16
 *                 tipo: "SAIDA"
 *                 quantidade: 5
 *                 quantidadeAnterior: 50
 *                 quantidadeResultante: 45
 *                 motivo: "Descarte por validade vencida"
 *                 realizadoPor: "colaborador#2 (GERENTE)"
 *                 criadoEm: "2026-05-21T13:00:00Z"
 *       409:
 *         description: Estoque insuficiente
 *         content:
 *           application/json:
 *             example:
 *               error: "ESTOQUE_INSUFICIENTE"
 *               message: "Não há quantidade suficiente para um ou mais itens."
 *               details:
 *                 - field: "quantidade"
 *                   issue: "Saldo disponível: 3. Solicitado: 5."
 *               timestamp: "2026-05-21T13:00:00Z"
 *               path: "/unidades/1/estoque/3/saida"
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       422:
 *         $ref: '#/components/responses/ErroValidacao'
 */
router.post('/:itemId/saida', authMiddleware, autorizar(...ESCRITA), EstoqueController.saida);

/**
 * @swagger
 * /unidades/{unidadeId}/estoque/{itemId}/ajuste:
 *   patch:
 *     summary: Ajusta o saldo do estoque para um valor exato (correção de inventário)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unidadeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: itemId
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
 *               - novaQuantidade
 *             properties:
 *               novaQuantidade:
 *                 type: integer
 *                 minimum: 0
 *                 example: 60
 *               motivo:
 *                 type: string
 *                 example: "Inventário mensal"
 *     responses:
 *       200:
 *         description: Ajuste realizado com sucesso
 *         content:
 *           application/json:
 *             example:
 *               estoque:
 *                 id: 1
 *                 quantidade: 60
 *                 atualizadoEm: "2026-05-21T14:00:00Z"
 *               movimentacao:
 *                 id: 17
 *                 tipo: "AJUSTE"
 *                 quantidade: 10
 *                 quantidadeAnterior: 50
 *                 quantidadeResultante: 60
 *                 motivo: "Inventário mensal"
 *                 realizadoPor: "colaborador#2 (GERENTE)"
 *                 criadoEm: "2026-05-21T14:00:00Z"
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       422:
 *         $ref: '#/components/responses/ErroValidacao'
 */
router.patch('/:itemId/ajuste', authMiddleware, autorizar(...ESCRITA), EstoqueController.ajuste);

module.exports = router;
