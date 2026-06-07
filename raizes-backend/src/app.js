const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./api/swagger/swagger.config');
const errorHandler = require('./api/middlewares/errorHandler');
const logger = require('./api/middlewares/logger');

const authRoutes = require('./api/routes/auth.routes');
const usuariosRoutes = require('./api/routes/usuarios.routes');
const unidadesRoutes = require('./api/routes/unidades.routes');
const produtosRoutes = require('./api/routes/produtos.routes');
const estoqueRoutes = require('./api/routes/estoque.routes');
const pedidosRoutes = require('./api/routes/pedidos.routes');
const pagamentosRoutes = require('./api/routes/pagamentos.routes');
const fidelidadeRoutes = require('./api/routes/fidelidade.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(logger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/auth', authRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/unidades', unidadesRoutes);
app.use('/unidades/:unidadeId/estoque', estoqueRoutes);
app.use('/produtos', produtosRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/pagamentos', pagamentosRoutes);
app.use('/fidelidade', fidelidadeRoutes);

app.use(errorHandler);

module.exports = app;
