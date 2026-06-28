const express = require('express');
const router = express.Router();
const {
  index, show, store, update, destroy,
  indexSugestoes, storeSugestao, aprovar, negar,
} = require('../controllers/ProdutoController');
const { authMiddleware, autorizar } = require('../middlewares/auth.middleware');
const { produtoSchema, sugestaoSchema, validar } = require('../../application/cardapio/cardapio.validation');

/**
 * @swagger
 * tags:
 *   name: Produtos
 *   description: Cardápio mestre e sugestões de itens
 */

/**
 * @swagger
 * /produtos:
 *   get:
 *     summary: Listar produtos com paginação e filtros
 *     tags: [Produtos]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: unidadeId
 *         schema:
 *           type: integer
 *         description: Filtra itens disponíveis em uma unidade específica
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *           enum: [LANCHE, BEBIDA, SOBREMESA, ACOMPANHAMENTO, COMBO, OUTRO]
 *     responses:
 *       200:
 *         description: Lista paginada de produtos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', index);

/**
 * @swagger
 * /produtos/sugestoes:
 *   get:
 *     summary: Listar sugestões de novos itens
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDENTE, APROVADA, REJEITADA]
 *       - in: query
 *         name: unidadeId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de sugestões
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 */
router.get('/sugestoes', authMiddleware, autorizar('ADMIN', 'MARKETING', 'GERENTE'), indexSugestoes);

/**
 * @swagger
 * /produtos/{id}:
 *   get:
 *     summary: Detalhar produto
 *     tags: [Produtos]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dados do produto com variações
 *       404:
 *         description: Produto não encontrado
 */
router.get('/:id', show);

/**
 * @swagger
 * /produtos:
 *   post:
 *     summary: Criar produto no cardápio mestre
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, categoria, variacoes]
 *             properties:
 *               nome:
 *                 type: string
 *               descricao:
 *                 type: string
 *               categoria:
 *                 type: string
 *                 enum: [LANCHE, BEBIDA, SOBREMESA, ACOMPANHAMENTO, COMBO, OUTRO]
 *               variacoes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tamanho:
 *                       type: string
 *                       example: M
 *                     preco:
 *                       type: number
 *                       example: 24.90
 *     responses:
 *       201:
 *         description: Produto criado
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       422:
 *         $ref: '#/components/responses/ErroValidacao'
 */
router.post('/', authMiddleware, autorizar('ADMIN', 'MARKETING'), validar(produtoSchema), store);

/**
 * @swagger
 * /produtos/{id}:
 *   put:
 *     summary: Atualizar produto
 *     tags: [Produtos]
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
 *         description: Produto atualizado
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.put('/:id', authMiddleware, autorizar('ADMIN', 'MARKETING'), validar(produtoSchema), update);

/**
 * @swagger
 * /produtos/{id}:
 *   delete:
 *     summary: Remover produto (Admin)
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Produto removido
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.delete('/:id', authMiddleware, autorizar('ADMIN'), destroy);

/**
 * @swagger
 * /produtos/sugestoes:
 *   post:
 *     summary: Criar sugestão de novo item (colaborador da unidade)
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome]
 *             properties:
 *               nome:
 *                 type: string
 *               descricao:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sugestão criada com status PENDENTE
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       422:
 *         $ref: '#/components/responses/ErroValidacao'
 */
router.post('/sugestoes', authMiddleware, autorizar('GERENTE', 'ATENDENTE'), validar(sugestaoSchema), storeSugestao);

/**
 * @swagger
 * /produtos/sugestoes/{id}/aprovar:
 *   patch:
 *     summary: Aprovar sugestão de item (Admin/Marketing)
 *     tags: [Produtos]
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
 *         description: Sugestão aprovada
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       409:
 *         description: Sugestão já processada
 */
router.patch('/sugestoes/:id/aprovar', authMiddleware, autorizar('ADMIN', 'MARKETING'), aprovar);

/**
 * @swagger
 * /produtos/sugestoes/{id}/negar:
 *   patch:
 *     summary: Negar sugestão de item (Admin/Marketing)
 *     tags: [Produtos]
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
 *               respostaAdmin:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sugestão negada
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.patch('/sugestoes/:id/negar', authMiddleware, autorizar('ADMIN', 'MARKETING'), negar);

module.exports = router;
