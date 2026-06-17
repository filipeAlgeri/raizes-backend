/**
 * Carregado via setupFiles no jest.config.js.
 *
 * Roda antes de qualquer import nos arquivos de teste, no mesmo processo do worker.
 * Isso garante que process.env.DATABASE_URL aponte para raizes_db_test
 * ANTES do Prisma client ser instanciado (client.js lê a variável na importação).
 */
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env.test'),
  override: true,
});
