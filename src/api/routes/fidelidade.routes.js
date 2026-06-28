const express = require('express');
const router = express.Router();
const { authMiddleware, autorizar } = require('../middlewares/auth.middleware');
const FidelidadeController = require('../controllers/FidelidadeController');

// Perfis com acesso de leitura ao programa de fidelidade
const LEITURA = ['CLIENTE', 'GERENTE', 'ADMIN', 'FINANCEIRO', 'SUPORTE'];
// Resgate: apenas o próprio cliente (validado no controller) ou admin
const RESGATE = ['CLIENTE', 'ADMIN'];

/**
 * @swagger
 * tags:
 *   name: Fidelidade
 *   description: |
 *     Programa de pontos da rede Raízes do Nordeste.
 *     Regras: R$1,00 = 1 ponto | 100 pontos = R$20,00 de desconto |
 *     Bônus de +15 pontos a cada 5 pedidos ENTREGUE.
 *     Participação exige aceiteFidelidade = true no cadastro do cliente.
 */

/**
 * @swagger
 * /fidelidade/{clienteId}/saldo:
 *   get:
 *     summary: Consulta o saldo de pontos de um cliente
 *     description: |
 *       Retorna saldo atual, total de pedidos concluídos, equivalente em reais
 *       e quantos pedidos faltam para o próximo bônus.
 *       Clientes só podem consultar o próprio saldo.
 *     tags: [Fidelidade]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clienteId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Saldo de pontos do cliente
 *         content:
 *           application/json:
 *             examples:
 *               comSaldo:
 *                 summary: Cliente com pontos acumulados
 *                 value:
 *                   id: 3
 *                   saldoAtual: 185
 *                   totalPedidos: 8
 *                   equivalenteEmReais: 20.00
 *                   proximoBonusEm: 2
 *                   cliente:
 *                     id: 5
 *                     nome: "Maria Silva"
 *                     email: "maria@teste.com"
 *               semRegistro:
 *                 summary: Cliente ainda sem movimentação
 *                 value:
 *                   saldoAtual: 0
 *                   totalPedidos: 0
 *                   clienteId: 5
 *                   equivalenteEmReais: 0
 *                   proximoBonusEm: 5
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       409:
 *         description: Cliente não aderiu ao programa de fidelidade
 *         content:
 *           application/json:
 *             example:
 *               error: "FIDELIDADE_NAO_ACEITA"
 *               message: "Cliente não aderiu ao programa de fidelidade."
 *               details:
 *                 - field: "clienteId"
 *                   issue: "O campo aceiteFidelidade deve ser true para participar."
 *               timestamp: "2026-05-21T12:00:00Z"
 *               path: "/fidelidade/5/saldo"
 */
router.get('/:clienteId/saldo', authMiddleware, autorizar(...LEITURA), FidelidadeController.saldo);

/**
 * @swagger
 * /fidelidade/{clienteId}/historico:
 *   get:
 *     summary: Lista o histórico de pontos de um cliente
 *     description: |
 *       Retorna todas as movimentações de pontos (ganho, bônus, resgate, estorno)
 *       em ordem decrescente. Clientes só consultam o próprio histórico.
 *     tags: [Fidelidade]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clienteId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [GANHO, BONUS_PEDIDOS, RESGATE, ESTORNO]
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
 *         description: Histórico paginado de pontos
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 - id: 12
 *                   tipo: "GANHO"
 *                   quantidade: 51
 *                   descricao: "Pedido #42 — R$51.80"
 *                   criadoEm: "2026-05-21T12:00:01Z"
 *                   pedido:
 *                     id: 42
 *                     status: "ENTREGUE"
 *                     total: 51.80
 *                     criadoEm: "2026-05-21T12:00:00Z"
 *                 - id: 13
 *                   tipo: "BONUS_PEDIDOS"
 *                   quantidade: 15
 *                   descricao: "Bônus por 5 pedidos concluídos"
 *                   criadoEm: "2026-05-21T12:00:01Z"
 *                   pedido:
 *                     id: 42
 *                     status: "ENTREGUE"
 *                     total: 51.80
 *                     criadoEm: "2026-05-21T12:00:00Z"
 *               meta:
 *                 clienteId: 5
 *                 total: 2
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 1
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       409:
 *         description: Cliente não aderiu ao programa
 *         content:
 *           application/json:
 *             example:
 *               error: "FIDELIDADE_NAO_ACEITA"
 *               message: "Cliente não aderiu ao programa de fidelidade."
 *               details:
 *                 - field: "clienteId"
 *                   issue: "O campo aceiteFidelidade deve ser true para participar."
 *               timestamp: "2026-05-21T12:00:00Z"
 *               path: "/fidelidade/5/historico"
 */
router.get('/:clienteId/historico', authMiddleware, autorizar(...LEITURA), FidelidadeController.historico);

/**
 * @swagger
 * /fidelidade/{clienteId}/resgatar:
 *   post:
 *     summary: Resgata pontos em troca de desconto
 *     description: |
 *       Converte blocos de 100 pontos em desconto de R$20,00 cada.
 *       Informe `qtdBlocos` = quantidade de blocos de 100 pontos a resgatar.
 *       Exemplo: qtdBlocos = 2 → débita 200 pontos → gera R$40,00 de desconto.
 *       Clientes só podem resgatar os próprios pontos.
 *     tags: [Fidelidade]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clienteId
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
 *               - qtdBlocos
 *             properties:
 *               qtdBlocos:
 *                 type: integer
 *                 minimum: 1
 *                 description: Número de blocos de 100 pontos a resgatar
 *                 example: 1
 *     responses:
 *       200:
 *         description: Resgate realizado com sucesso
 *         content:
 *           application/json:
 *             example:
 *               pontosResgatados: 100
 *               valorDesconto: 20.00
 *               saldoAnterior: 185
 *               saldoAtual: 85
 *               historico:
 *                 id: 14
 *                 tipo: "RESGATE"
 *                 quantidade: -100
 *                 descricao: "Resgate de 1 bloco(s) — desconto de R$20.00"
 *                 criadoEm: "2026-05-21T13:00:00Z"
 *       401:
 *         $ref: '#/components/responses/NaoAutenticado'
 *       403:
 *         $ref: '#/components/responses/SemPermissao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       409:
 *         description: Saldo insuficiente ou cliente não aderiu
 *         content:
 *           application/json:
 *             examples:
 *               saldoInsuficiente:
 *                 summary: Pontos insuficientes para resgate
 *                 value:
 *                   error: "SALDO_INSUFICIENTE"
 *                   message: "Saldo insuficiente para resgate. Necessário: 100 pts. Disponível: 85 pts."
 *                   details:
 *                     - field: "qtdBlocos"
 *                       issue: "Necessário: 100 pts. Disponível: 85 pts."
 *                   timestamp: "2026-05-21T13:00:00Z"
 *                   path: "/fidelidade/5/resgatar"
 *               naoAderiu:
 *                 summary: Cliente sem programa ativo
 *                 value:
 *                   error: "FIDELIDADE_NAO_ACEITA"
 *                   message: "Cliente não aderiu ao programa de fidelidade."
 *                   details:
 *                     - field: "clienteId"
 *                       issue: "O campo aceiteFidelidade deve ser true para participar."
 *                   timestamp: "2026-05-21T13:00:00Z"
 *                   path: "/fidelidade/5/resgatar"
 *       422:
 *         description: qtdBlocos ausente ou inválido
 *         content:
 *           application/json:
 *             example:
 *               error: "DADOS_INVALIDOS"
 *               message: "O campo qtdBlocos é obrigatório."
 *               details:
 *                 - field: "qtdBlocos"
 *                   issue: "Campo obrigatório."
 *               timestamp: "2026-05-21T13:00:00Z"
 *               path: "/fidelidade/5/resgatar"
 */
router.post('/:clienteId/resgatar', authMiddleware, autorizar(...RESGATE), FidelidadeController.resgatar);

module.exports = router;
