/**
 * Testes de integração — Unidades
 *
 * O que testamos aqui:
 *  - GET   /unidades     → listar unidades ativas (rota pública, sem auth)
 *  - GET   /unidades/:id → detalhar unidade (rota pública)
 *  - POST  /unidades     → criar nova unidade (ADMIN apenas)
 *  - PATCH /unidades/:id → atualizar dados de unidade (ADMIN apenas)
 *
 * Estratégia de isolamento:
 *  - GET é público: não requer token.
 *  - POST e PATCH exigem perfil ADMIN (usuário central).
 *  - Unidades criadas nos testes são rastreadas em unidadesCriadas[] e
 *    apagadas no afterAll (sem dependências — unidades novas não têm estoque,
 *    colaboradores ou pedidos associados).
 *
 * Dados do seed utilizados:
 *  - Unidade id=1, CNPJ='12345678000100', nome='Raízes do Nordeste — Matriz Recife'
 *
 * Roles verificadas:
 *  GET    : público (sem token)
 *  POST   : ADMIN ✓ | GERENTE → 403 | CLIENTE → 403 | sem token → 401
 *  PATCH  : ADMIN ✓ | GERENTE → 403
 */
const request = require('supertest');
const app = require('../app');
const { prisma } = require('./helpers/db');

let tokenAdmin;
let tokenGerente;
let tokenCliente;
const unidadesCriadas = []; // IDs para limpeza no afterAll

const CNPJ_SEED = '12345678000100'; // CNPJ da Matriz Recife (seed)

const PAYLOAD_UNIDADE = {
  nome: 'Raízes Jest — Filial Caruaru',
  cnpj: '98765432000199', // CNPJ único: 14 dígitos, não existe no seed
  cidade: 'Caruaru',
  estado: 'PE',
  endereco: 'Rua das Flores, 500',
  telefone: '8199990000',
};

beforeAll(async () => {
  const resAdmin = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@raizesdnordeste.com', senha: 'Admin@123', tipo: 'central' });
  tokenAdmin = resAdmin.body.accessToken;

  const resGerente = await request(app)
    .post('/auth/login')
    .send({ email: 'gerente@raizesdnordeste.com', senha: 'Gerente@123', tipo: 'colaborador' });
  tokenGerente = resGerente.body.accessToken;

  const resCliente = await request(app)
    .post('/auth/login')
    .send({ email: 'cliente@teste.com', senha: 'Cliente@123', tipo: 'cliente' });
  tokenCliente = resCliente.body.accessToken;
});

afterAll(async () => {
  // Unidades de teste não têm dependências (criadas "vazias"), então delete direto
  if (unidadesCriadas.length > 0) {
    await prisma.unidade.deleteMany({ where: { id: { in: unidadesCriadas } } });
  }
  await prisma.$disconnect();
});

// =============================================================
// LISTAGEM DE UNIDADES (pública)
// =============================================================
describe('GET /unidades', () => {
  it('lista unidades ativas sem autenticação → 200 + array de unidades', async () => {
    const res = await request(app).get('/unidades');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Seed cria 1 unidade ativa
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const unidade = res.body[0];
    expect(unidade).toHaveProperty('id');
    expect(unidade).toHaveProperty('nome');
    expect(unidade).toHaveProperty('cidade');
    expect(unidade).toHaveProperty('estado');
    // CNPJ NÃO é exposto na listagem (apenas no endpoint de detalhe)
    expect(unidade.cnpj).toBeUndefined();
  });

  it('inclui a unidade do seed na listagem → 200', async () => {
    const res = await request(app).get('/unidades');

    const nomes = res.body.map((u) => u.nome);
    expect(nomes).toContain('Raízes do Nordeste — Matriz Recife');
  });
});

// =============================================================
// DETALHE DE UNIDADE (público)
// =============================================================
describe('GET /unidades/:id', () => {
  it('retorna shape completo da Matriz Recife (id=1) → 200', async () => {
    const res = await request(app).get('/unidades/1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.cidade).toBe('Recife');
    expect(res.body.estado).toBe('PE');
    expect(res.body.ativa).toBe(true);
    // CNPJ só aparece no detalhe individual
    expect(res.body.cnpj).toBe(CNPJ_SEED);
  });

  it('unidade inexistente → 404', async () => {
    const res = await request(app).get('/unidades/9999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('RECURSO_NAO_ENCONTRADO');
  });
});

// =============================================================
// CRIAÇÃO DE UNIDADE
// =============================================================
describe('POST /unidades', () => {
  it('admin cria nova filial com dados válidos → 201', async () => {
    const res = await request(app)
      .post('/unidades')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(PAYLOAD_UNIDADE);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.nome).toBe(PAYLOAD_UNIDADE.nome);
    expect(res.body.cidade).toBe(PAYLOAD_UNIDADE.cidade);
    expect(res.body.ativa).toBe(true); // criada como ativa por padrão

    unidadesCriadas.push(res.body.id);
  });

  it('CNPJ já cadastrado → 409 CNPJ_JA_CADASTRADO', async () => {
    // Tenta criar outra unidade com o CNPJ do seed → conflito de unicidade
    const res = await request(app)
      .post('/unidades')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...PAYLOAD_UNIDADE, cnpj: CNPJ_SEED });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CNPJ_JA_CADASTRADO');
  });

  it('gerente não tem permissão para criar unidade → 403', async () => {
    const res = await request(app)
      .post('/unidades')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send(PAYLOAD_UNIDADE);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('cliente não tem permissão para criar unidade → 403', async () => {
    const res = await request(app)
      .post('/unidades')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send(PAYLOAD_UNIDADE);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('sem token → 401', async () => {
    const res = await request(app).post('/unidades').send(PAYLOAD_UNIDADE);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NAO_AUTENTICADO');
  });

  it('CNPJ com formato inválido → 422 VALIDACAO_INVALIDA', async () => {
    // unidadeSchema exige CNPJ com exatamente 14 dígitos numéricos
    const res = await request(app)
      .post('/unidades')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...PAYLOAD_UNIDADE, cnpj: '12.345.678/0001-00' }); // com pontuação

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDACAO_INVALIDA');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'cnpj' })])
    );
  });
});

// =============================================================
// ATUALIZAÇÃO DE UNIDADE
// =============================================================
describe('PATCH /unidades/:id', () => {
  let unidadeIdParaEditar;

  beforeAll(async () => {
    // Unidade dedicada aos testes de PATCH — CNPJ único para não conflitar
    const res = await request(app)
      .post('/unidades')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...PAYLOAD_UNIDADE, cnpj: '11222333000181', nome: 'Raízes Jest — Para Editar' });
    unidadeIdParaEditar = res.body.id;
    unidadesCriadas.push(unidadeIdParaEditar);
  });

  it('admin atualiza nome e cidade → 200 + dados refletidos', async () => {
    // PATCH não usa validar(unidadeSchema), então dados parciais são aceitos
    const res = await request(app)
      .patch(`/unidades/${unidadeIdParaEditar}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nome: 'Raízes Jest — Editada com Sucesso', cidade: 'Olinda' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Raízes Jest — Editada com Sucesso');
  });

  it('gerente não tem permissão → 403', async () => {
    const res = await request(app)
      .patch(`/unidades/${unidadeIdParaEditar}`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ nome: 'Tentativa Gerente' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('unidade inexistente → 404', async () => {
    const res = await request(app)
      .patch('/unidades/9999')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nome: 'Não Existe' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('RECURSO_NAO_ENCONTRADO');
  });
});
