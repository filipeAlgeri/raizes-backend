const express = require('express');
const router = express.Router();
const { index, show, store, update } = require('../controllers/UnidadeController');
const { configurarCardapio } = require('../controllers/ProdutoController');
const { authMiddleware, autorizar } = require('../middlewares/auth.middleware');
const { unidadeSchema, unidadePatchSchema, cardapioUnidadeSchema, validar } = require('../../application/cardapio/cardapio.validation');

/**
 * @swagger
 * tags:
 *   name: Unidades
 *   description: Gestão das unidades da rede
 */

/**
 * @swagger
 * /unidades:
 *   get:
 *     summary: Listar unidades ativas
 *     tags: [Unidades]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de unidades
 */
router.get('/', index);

/**
 * @swagger
 * /unidades/{id}:
 *   get:
 *     summary: Detalhar uma unidade
 *     tags: [Unidades]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dados da unidade
 *       404:
 *         description: Unidade não encontrada
 */
router.get('/:id', show);

/**
 * @swagger
 * /unidades:
 *   post:
 *     summary: Criar nova unidade (Admin central)
 *     tags: [Unidades]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, cnpj, cidade, estado, endereco]
 *             properties:
 *               nome:
 *                 type: string
 *               cnpj:
 *                 type: string
 *                 example: "12345678000100"
 *               cidade:
 *                 type: string
 *               estado:
 *                 type: string
 *                 example: PE
 *               endereco:
 *                 type: string
 *               telefone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Unidade criada
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       409:
 *         description: CNPJ já cadastrado
 *       422:
 *         $ref: '#/components/responses/ErroValidacao'
 */
router.post('/', authMiddleware, autorizar('ADMIN'), validar(unidadeSchema), store);

/**
 * @swagger
 * /unidades/{id}:
 *   patch:
 *     summary: Atualizar dados da unidade (Admin central)
 *     tags: [Unidades]
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
 *         description: Unidade atualizada
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 */
router.patch('/:id', authMiddleware, autorizar('ADMIN'), validar(unidadePatchSchema), update);

/**
 * @swagger
 * /unidades/{unidadeId}/cardapio:
 *   patch:
 *     summary: Ativar/desativar item no cardápio da unidade
 *     tags: [Unidades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unidadeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemId, disponivel]
 *             properties:
 *               itemId:
 *                 type: integer
 *               disponivel:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cardápio atualizado
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       422:
 *         $ref: '#/components/responses/ErroValidacao'
 */
router.patch(
  '/:unidadeId/cardapio',
  authMiddleware,
  autorizar('GERENTE', 'ADMIN'),
  validar(cardapioUnidadeSchema),
  configurarCardapio
);

module.exports = router;
