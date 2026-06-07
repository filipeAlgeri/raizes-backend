const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/AuthController');
const { cadastroSchema, loginSchema, validar } = require('../../application/auth/auth.validation');
const { authMiddleware } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticação e cadastro de usuários
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Cadastrar novo cliente
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, cpf, senha, aceiteLgpd]
 *             properties:
 *               nome:
 *                 type: string
 *                 example: Maria Silva
 *               email:
 *                 type: string
 *                 example: maria@email.com
 *               telefone:
 *                 type: string
 *                 example: "81999990000"
 *               cpf:
 *                 type: string
 *                 example: "12345678901"
 *               senha:
 *                 type: string
 *                 example: Senha@123
 *               aceiteLgpd:
 *                 type: boolean
 *                 example: true
 *               aceiteFidelidade:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Cliente cadastrado com sucesso
 *       409:
 *         description: E-mail ou CPF já cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erropadrao'
 *       422:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erropadrao'
 */
router.post('/register', validar(cadastroSchema), register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login e retorno de JWT
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties:
 *               email:
 *                 type: string
 *                 example: maria@email.com
 *               senha:
 *                 type: string
 *                 example: Senha@123
 *               tipo:
 *                 type: string
 *                 enum: [cliente, colaborador, central]
 *                 default: cliente
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 tokenType:
 *                   type: string
 *                   example: Bearer
 *                 expiresIn:
 *                   type: string
 *                   example: 1h
 *                 usuario:
 *                   type: object
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erropadrao'
 */
router.post('/login', validar(loginSchema), login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Encerrar sessão
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: Logout realizado
 *       401:
 *         description: Não autenticado
 */
router.post('/logout', authMiddleware, logout);

module.exports = router;
