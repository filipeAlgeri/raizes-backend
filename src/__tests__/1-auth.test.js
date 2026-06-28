/**
 * Testes de integração — Autenticação
 *
 * O que testamos aqui:
 *  - POST /auth/register  → cadastro de clientes
 *  - POST /auth/login     → login para cliente, colaborador e central
 *
 * Estratégia de isolamento:
 *  - O globalSetup já resetou o banco antes deste arquivo rodar.
 *  - Clientes criados nos testes são removidos no afterAll.
 *  - Os testes de login usam as credenciais do seed (sempre presentes).
 */
const request = require('supertest');
const app = require('../app');
const { prisma, deletarClientePorEmail } = require('./helpers/db');

// Dados do cliente que será criado nos testes de register.
// CPF e e-mail são únicos — não conflitam com o seed.
const CLIENTE_NOVO = {
  nome: 'Novo Cliente Teste',
  email: 'novo@raizes.test',
  cpf: '11100022200',
  senha: 'Teste@123',
  aceiteLgpd: true,
  aceiteFidelidade: true,
};

afterAll(async () => {
  await deletarClientePorEmail(CLIENTE_NOVO.email);
  await prisma.$disconnect();
});

// =============================================================
// CADASTRO DE CLIENTES
// =============================================================
describe('POST /auth/register', () => {
  it('cadastra novo cliente com dados válidos → 201', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(CLIENTE_NOVO);

    expect(res.status).toBe(201);
    // Verifica o shape da resposta
    expect(res.body).toMatchObject({
      nome: CLIENTE_NOVO.nome,
      email: CLIENTE_NOVO.email,
      aceiteFidelidade: true,
    });
    expect(res.body).toHaveProperty('id');
    // Garante que o hash da senha nunca é exposto
    expect(res.body.senhaHash).toBeUndefined();
  });

  it('rejeita e-mail já cadastrado → 409', async () => {
    // Mesmo payload do teste anterior — e-mail duplicado
    const res = await request(app)
      .post('/auth/register')
      .send(CLIENTE_NOVO);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_JA_CADASTRADO');
  });

  it('rejeita CPF já cadastrado → 409', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...CLIENTE_NOVO, email: 'outro@raizes.test' }); // mesmo CPF

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CPF_JA_CADASTRADO');
  });

  it('rejeita quando aceiteLgpd é false → 422', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        ...CLIENTE_NOVO,
        email: 'semLgpd@raizes.test',
        cpf: '55500066600',
        aceiteLgpd: false,
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('ACEITE_LGPD_OBRIGATORIO');
  });

  it('rejeita senha sem letra maiúscula → 422', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        ...CLIENTE_NOVO,
        email: 'senhafraca@raizes.test',
        cpf: '77700088800',
        senha: 'senhasemmaius1', // sem maiúscula
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDACAO_INVALIDA');
    // Confirma que o detalhe aponta para o campo correto
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'senha' }),
      ])
    );
  });

  it('rejeita CPF com pontuação (formato inválido) → 422', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        ...CLIENTE_NOVO,
        email: 'cpferrado@raizes.test',
        cpf: '111.000.222-00', // formato incorreto — deve ser 11 dígitos numéricos
      });

    expect(res.status).toBe(422);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'cpf' }),
      ])
    );
  });
});

// =============================================================
// LOGIN DE CLIENTE
// =============================================================
describe('POST /auth/login — tipo: cliente', () => {
  it('retorna accessToken com credenciais válidas → 200', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'cliente@teste.com', senha: 'Cliente@123', tipo: 'cliente' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      usuario: { perfil: 'CLIENTE', email: 'cliente@teste.com' },
    });
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(20);
  });

  it('rejeita senha incorreta → 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'cliente@teste.com', senha: 'SenhaErrada@1', tipo: 'cliente' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('CREDENCIAIS_INVALIDAS');
  });

  it('rejeita e-mail que não existe → 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'fantasma@teste.com', senha: 'Qualquer@1', tipo: 'cliente' });

    expect(res.status).toBe(401);
  });

  it('rejeita e-mail malformado no body → 422', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nao-e-um-email', senha: 'Qualquer@1' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDACAO_INVALIDA');
  });
});

// =============================================================
// LOGIN DE COLABORADOR
// =============================================================
describe('POST /auth/login — tipo: colaborador', () => {
  it('retorna token para gerente → 200', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'gerente@raizesdnordeste.com', senha: 'Gerente@123', tipo: 'colaborador' });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ perfil: 'GERENTE', unidadeId: 1 });
    expect(res.body).toHaveProperty('accessToken');
  });

  it('rejeita senha errada para gerente → 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'gerente@raizesdnordeste.com', senha: 'Errada@123', tipo: 'colaborador' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('CREDENCIAIS_INVALIDAS');
  });
});

// =============================================================
// LOGIN CENTRAL (ADMIN)
// =============================================================
describe('POST /auth/login — tipo: central', () => {
  it('retorna token para admin central → 200', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@raizesdnordeste.com', senha: 'Admin@123', tipo: 'central' });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ perfil: 'ADMIN' });
  });
});

// =============================================================
// PROTEÇÃO DE ROTAS
// =============================================================
describe('POST /auth/logout — rota protegida', () => {
  it('rejeita logout sem token → 401', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NAO_AUTENTICADO');
  });

  it('rejeita logout com token inválido → 401', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', 'Bearer token.falso.aqui');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('TOKEN_INVALIDO');
  });
});
