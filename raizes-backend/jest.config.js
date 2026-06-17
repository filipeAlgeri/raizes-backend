module.exports = {
  // Jest executa testes em Node.js puro (não browser)
  testEnvironment: 'node',

  // Roda UMA VEZ antes de todos os arquivos de teste (cria e reseta o banco raizes_db_test)
  globalSetup: './src/__tests__/helpers/globalSetup.js',

  // Roda UMA VEZ após todos os arquivos de teste
  globalTeardown: './src/__tests__/helpers/globalTeardown.js',

  // Roda antes de CADA arquivo de teste, no mesmo processo do worker:
  // carrega o .env.test para que DATABASE_URL aponte para raizes_db_test
  // antes de qualquer módulo ser importado (incluindo o Prisma client)
  setupFiles: ['./src/__tests__/helpers/loadEnv.js'],

  // Padrão de arquivos de teste — prefixo numérico garante a ordem de execução
  testMatch: ['**/__tests__/**/*.test.js'],

  // 30 s por teste (integração com banco pode ser lento)
  testTimeout: 30000,

  // Mostra cada teste individualmente no terminal
  verbose: true,
};
