const express = require('express');
const router = express.Router();
// Não há endpoints separados em /pagamentos.
// O processamento do gateway mock ocorre dentro de POST /pedidos (pedidoService.js),
// na mesma transação atômica que cria o pedido e decrementa o estoque.
// Ver decisão de design na seção 13 do README.
module.exports = router;
