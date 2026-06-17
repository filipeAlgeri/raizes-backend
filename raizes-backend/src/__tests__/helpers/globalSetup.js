/**
 * globalSetup — roda UMA vez antes de todos os testes, em processo separado.
 *
 * Estratégia (sem precisar de privilégio CREATEDB):
 *  1. Cria raizes_db_test se não existir.
 *  2. migrate deploy → aplica migrations sem dropar o banco.
 *  3. TRUNCATE em todas as tabelas → limpa dados de execuções anteriores.
 *  4. node prisma/seed.js → recarrega dados iniciais.
 *
 * Resultado: banco limpo + seed, pronto para os testes.
 */
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function globalSetup() {
  require('dotenv').config({
    path: path.resolve(__dirname, '../../../.env.test'),
    override: true,
  });

  const dbUrl = new URL(process.env.DATABASE_URL);
  const dbName = dbUrl.pathname.replace('/', '');
  const projectRoot = path.resolve(__dirname, '../../..');

  // Env para comandos psql/createdb (senha via variável de ambiente)
  const pgEnv = { ...process.env, PGPASSWORD: dbUrl.password };

  const psqlCmd = [
    'psql',
    `-h ${dbUrl.hostname}`,
    `-p ${dbUrl.port || 5432}`,
    `-U ${dbUrl.username}`,
    `-d ${dbName}`,
  ].join(' ');

  // 1. Criar o banco se não existir
  try {
    execSync(
      `createdb -h ${dbUrl.hostname} -p ${dbUrl.port || 5432} -U ${dbUrl.username} ${dbName}`,
      { stdio: 'ignore', env: pgEnv }
    );
    console.log(`\n[globalSetup] Banco "${dbName}" criado.`);
  } catch {
    console.log(`\n[globalSetup] Banco "${dbName}" já existe.`);
  }

  // 2. Garantir que o schema está atualizado
  //    Este projeto usa "db push" (sem pasta migrations) em vez de migrate dev.
  //    db push sincroniza o schema.prisma com o banco sem precisar de shadow DB.
  console.log('[globalSetup] Sincronizando schema com o banco...');
  execSync('npx prisma db push --accept-data-loss', {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: 'inherit',
  });

  // 3. Truncar todas as tabelas e reiniciar sequences (estado limpo)
  //    CASCADE garante que PostgreSQL resolve a ordem de FK automaticamente.
  const tabelas = [
    'logs_pedido', 'historico_pontos', 'notificacoes',
    'movimentacoes_estoque', 'itens_pedido', 'pagamentos',
    'pedidos', 'pontos_cliente', 'sugestoes_item',
    'voucher_unidade', 'vouchers', 'cardapio_unidade',
    'campanhas', 'estoque', 'variacoes_item', 'itens_cardapio',
    'colaboradores', 'clientes', 'usuarios_central', 'unidades',
  ].join(', ');

  const truncateSQL = `TRUNCATE TABLE ${tabelas} RESTART IDENTITY CASCADE`;

  console.log('\n[globalSetup] Limpando dados...');
  execSync(`${psqlCmd} -c "${truncateSQL}"`, { env: pgEnv, stdio: 'inherit' });

  // 4. Popular com os dados do seed
  console.log('[globalSetup] Executando seed...');
  execSync('node prisma/seed.js', {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: 'inherit',
  });

  console.log('\n[globalSetup] Banco de testes pronto!\n');
};
