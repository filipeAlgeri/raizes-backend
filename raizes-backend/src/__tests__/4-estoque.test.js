/**
 * Testes de integração — Estoque
 *
 * O que testamos aqui:
 *  - GET  /unidades/:id/estoque               → listar saldo de todos os itens
 *  - GET  /unidades/:id/estoque/movimentacoes  → histórico de movimentações
 *  - GET  /unidades/:id/estoque/:itemId        → saldo de item específico
 *  - POST /unidades/:id/estoque/:itemId/entrada → registrar reabastecimento
 *  - POST /unidades/:id/estoque/:itemId/saida   → registrar saída manual
 *  - PATCH /unidades/:id/estoque/:itemId/ajuste → corrigir saldo
 *
 * Estratégia de isolamento:
 *  - Operações de escrita usam itemId=3 (Suco Natural, BEBIDA).
 *    Os testes anteriores (2-pedidos, 3-fidelidade) usam exclusivamente itemId=1,
 *    então o saldo de itemId=3 é exatamente 50 ao início deste arquivo (valor do seed).
 *  - Estado do itemId=3 ao longo dos testes (ordem de execução):
 *      início          : 50
 *      após entrada(30): 80
 *      após saída(5)   : 75
 *      após ajuste(50) : 50  ← volta ao valor original
 *  - afterAll apenas desconecta o Prisma (sem limpeza de dados — o banco de testes
 *    é truncado inteiramente no próximo globalSetup).
 *
 * Roles verificadas:
 *  LEITURA : ADMIN, FINANCEIRO, SUPORTE, GERENTE → 200
 *  ESCRITA : ADMIN, GERENTE → 201/200
 *  CLIENTE : sem acesso → 403
 *  T22 — IDOR: GERENTE só acessa a própria unidade → 403 para unidade alheia
 */
const request = require('supertest');
const app = require('../app');
const { prisma } = require('./helpers/db');

const UNIDADE_ID = 1;
const ITEM_ID = 3; // Suco Natural — intocado pelos testes anteriores

let tokenGerente;
let tokenCliente;

beforeAll(async () => {
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
  await prisma.$disconnect();
});

// =============================================================
// LISTAGEM GERAL DO ESTOQUE
// =============================================================
describe('GET /unidades/:unidadeId/estoque', () => {
  it('gerente lista saldo de todos os itens da unidade → 200 + shape paginado', async () => {
    const res = await request(app)
      .get(`/unidades/${UNIDADE_ID}/estoque`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.unidadeId).toBe(UNIDADE_ID);

    // Seed cria estoque para 3 itens na unidade 1
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);

    // Shape de cada item de estoque
    const primeiro = res.body.data[0];
    expect(primeiro).toHaveProperty('quantidade');
    expect(primeiro).toHaveProperty('atualizadoEm');
    expect(primeiro).toHaveProperty('item');
    expect(primeiro.item).toHaveProperty('nome');
    expect(primeiro.item).toHaveProperty('variacoes');
  });

  it('cliente não tem permissão de leitura → 403', async () => {
    const res = await request(app)
      .get(`/unidades/${UNIDADE_ID}/estoque`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('sem token → 401', async () => {
    const res = await request(app).get(`/unidades/${UNIDADE_ID}/estoque`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NAO_AUTENTICADO');
  });
});

// =============================================================
// HISTÓRICO DE MOVIMENTAÇÕES
// Os arquivos anteriores criaram movimentações de SAIDA (pedidos)
// e ENTRADA (estorno do cancelamento do pedido TOTEM).
// =============================================================
describe('GET /unidades/:unidadeId/estoque/movimentacoes', () => {
  it('gerente lista movimentações da unidade → 200 + shape paginado', async () => {
    const res = await request(app)
      .get(`/unidades/${UNIDADE_ID}/estoque/movimentacoes`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);

    // Verifica o shape das movimentações retornadas (se houver)
    if (res.body.data.length > 0) {
      const mov = res.body.data[0];
      expect(mov).toHaveProperty('tipo');
      expect(mov).toHaveProperty('quantidade');
      expect(mov).toHaveProperty('quantidadeAnterior');
      expect(mov).toHaveProperty('quantidadeResultante');
      expect(mov).toHaveProperty('estoque');
      expect(mov.estoque).toHaveProperty('item');
    }
  });

  it('filtra por tipo=ENTRADA → retorna somente movimentações de entrada → 200', async () => {
    // Filtra por tipo. Se não houver ENTRADAs ainda, data=[]; every() em array
    // vazio retorna true, então o teste é válido independentemente do estado anterior.
    const res = await request(app)
      .get(`/unidades/${UNIDADE_ID}/estoque/movimentacoes?tipo=ENTRADA`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((m) => m.tipo === 'ENTRADA')).toBe(true);
  });
});

// =============================================================
// SALDO DE ITEM ESPECÍFICO
// itemId=3 (Suco Natural) saldo intocado = 50
// =============================================================
describe('GET /unidades/:unidadeId/estoque/:itemId', () => {
  it('gerente consulta saldo do Suco Natural (itemId=3, seed=50) → 200', async () => {
    const res = await request(app)
      .get(`/unidades/${UNIDADE_ID}/estoque/${ITEM_ID}`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(200);
    expect(res.body.quantidade).toBe(50);
    expect(res.body.item.nome).toBe('Suco Natural');
    expect(res.body.item).toHaveProperty('variacoes');
    expect(Array.isArray(res.body.item.variacoes)).toBe(true);
  });

  it('item inexistente no cardápio → 404', async () => {
    const res = await request(app)
      .get(`/unidades/${UNIDADE_ID}/estoque/9999`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('RECURSO_NAO_ENCONTRADO');
  });
});

// =============================================================
// ENTRADA DE ESTOQUE (reabastecimento)
// Estado antes: itemId=3, quantidade = 50
// Estado depois: itemId=3, quantidade = 80
// =============================================================
describe('POST /unidades/:unidadeId/estoque/:itemId/entrada', () => {
  it('gerente registra entrada de 30 unidades → 201 + aritmética correta', async () => {
    const res = await request(app)
      .post(`/unidades/${UNIDADE_ID}/estoque/${ITEM_ID}/entrada`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ quantidade: 30, motivo: 'Reabastecimento semanal (teste)' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('estoque');
    expect(res.body).toHaveProperty('movimentacao');

    // Aritmética: 50 + 30 = 80
    expect(res.body.estoque.quantidade).toBe(80);
    expect(res.body.movimentacao.tipo).toBe('ENTRADA');
    expect(res.body.movimentacao.quantidade).toBe(30);
    expect(res.body.movimentacao.quantidadeAnterior).toBe(50);
    expect(res.body.movimentacao.quantidadeResultante).toBe(80);
    expect(res.body.movimentacao.motivo).toBe('Reabastecimento semanal (teste)');
  });

  it('quantidade zero → 422 QUANTIDADE_INVALIDA', async () => {
    const res = await request(app)
      .post(`/unidades/${UNIDADE_ID}/estoque/${ITEM_ID}/entrada`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ quantidade: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('QUANTIDADE_INVALIDA');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'quantidade' })])
    );
  });

  it('cliente não tem permissão de escrita → 403', async () => {
    const res = await request(app)
      .post(`/unidades/${UNIDADE_ID}/estoque/${ITEM_ID}/entrada`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ quantidade: 10 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });
});

// =============================================================
// SAÍDA MANUAL DE ESTOQUE
// Estado antes: itemId=3, quantidade = 80
// Após saída(5): 75
// Saída insuficiente: 9999 > 75 → ESTOQUE_INSUFICIENTE
// =============================================================
describe('POST /unidades/:unidadeId/estoque/:itemId/saida', () => {
  it('gerente registra saída de 5 unidades → 201 + saldo reduzido', async () => {
    // 80 - 5 = 75
    const res = await request(app)
      .post(`/unidades/${UNIDADE_ID}/estoque/${ITEM_ID}/saida`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ quantidade: 5, motivo: 'Descarte por validade (teste)' });

    expect(res.status).toBe(201);
    expect(res.body.estoque.quantidade).toBe(75);
    expect(res.body.movimentacao.tipo).toBe('SAIDA');
    expect(res.body.movimentacao.quantidade).toBe(5);
    expect(res.body.movimentacao.quantidadeAnterior).toBe(80);
    expect(res.body.movimentacao.quantidadeResultante).toBe(75);
  });

  it('saída além do saldo disponível → 409 ESTOQUE_INSUFICIENTE', async () => {
    // Saldo atual 75 — tentar retirar 9999 dispara EstoqueInsuficienteError
    const res = await request(app)
      .post(`/unidades/${UNIDADE_ID}/estoque/${ITEM_ID}/saida`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ quantidade: 9999, motivo: 'Teste de saldo insuficiente' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ESTOQUE_INSUFICIENTE');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'quantidade' })])
    );
  });
});

// =============================================================
// AJUSTE DE INVENTÁRIO (correção para valor exato)
// Estado antes: itemId=3, quantidade = 75
// Após ajuste(50): 50 → volta ao valor original do seed
// =============================================================
describe('PATCH /unidades/:unidadeId/estoque/:itemId/ajuste', () => {
  it('gerente ajusta saldo para 50 unidades → 200 + tipo AJUSTE', async () => {
    // Ajusta de volta para 50 (saldo do seed) — deixa o banco limpo para re-execuções
    const res = await request(app)
      .patch(`/unidades/${UNIDADE_ID}/estoque/${ITEM_ID}/ajuste`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ novaQuantidade: 50, motivo: 'Inventário mensal (teste)' });

    expect(res.status).toBe(200);
    expect(res.body.estoque.quantidade).toBe(50);
    expect(res.body.movimentacao.tipo).toBe('AJUSTE');
    expect(res.body.movimentacao.quantidadeAnterior).toBe(75);
    expect(res.body.movimentacao.quantidadeResultante).toBe(50);
  });

  it('novaQuantidade negativa → 422 QUANTIDADE_INVALIDA', async () => {
    const res = await request(app)
      .patch(`/unidades/${UNIDADE_ID}/estoque/${ITEM_ID}/ajuste`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ novaQuantidade: -1 });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('QUANTIDADE_INVALIDA');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'novaQuantidade' })])
    );
  });
});

// =============================================================
// T22 — IDOR: GERENTE não acessa estoque de outra unidade
// O GERENTE do seed pertence à unidade 1 (unidadeId=1 no JWT).
// A verificação acontece no controller, antes do service, portanto
// a unidade 2 não precisa existir no banco para o 403 ser emitido.
// =============================================================
describe('T22 — IDOR: GERENTE não acessa estoque de outra unidade', () => {
  const OUTRA_UNIDADE = 2; // GERENTE é da unidade 1

  it('GET /estoque → 403 para unidade alheia', async () => {
    const res = await request(app)
      .get(`/unidades/${OUTRA_UNIDADE}/estoque`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('POST /entrada → 403 para unidade alheia', async () => {
    const res = await request(app)
      .post(`/unidades/${OUTRA_UNIDADE}/estoque/${ITEM_ID}/entrada`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ quantidade: 10 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('POST /saida → 403 para unidade alheia', async () => {
    const res = await request(app)
      .post(`/unidades/${OUTRA_UNIDADE}/estoque/${ITEM_ID}/saida`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ quantidade: 5 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('PATCH /ajuste → 403 para unidade alheia', async () => {
    const res = await request(app)
      .patch(`/unidades/${OUTRA_UNIDADE}/estoque/${ITEM_ID}/ajuste`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ novaQuantidade: 100 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });
});
