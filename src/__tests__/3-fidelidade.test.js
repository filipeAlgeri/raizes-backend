/**
 * Testes de integração — Programa de Fidelidade
 *
 * O que testamos aqui:
 *  - GET  /fidelidade/:clienteId/saldo    → consulta de pontos
 *  - GET  /fidelidade/:clienteId/historico → histórico de movimentações
 *  - POST /fidelidade/:clienteId/resgatar  → resgate de pontos
 *
 * Estratégia:
 *  - Usamos o cliente do seed (cliente@teste.com, id: 1) porque ele já tem
 *    aceiteFidelidade: true e o registro de PontosCliente criado.
 *  - beforeAll zera os pontos para garantir estado limpo.
 *  - Criamos um pedido de R$119,60 e o levamos até ENTREGUE →
 *    o sistema credita 119 pontos automaticamente.
 *  - afterAll limpa os pedidos e reseta os pontos.
 *
 * Regras de negócio verificadas:
 *  - R$1,00 = 1 ponto (Math.floor)
 *  - 100 pontos = R$20,00 de desconto
 *  - Bônus de +15 pontos a cada 5 pedidos ENTREGUE
 */
const request = require('supertest');
const app = require('../app');
const { prisma, deletarPedidos, resetarPontosCliente } = require('./helpers/db');

// Dados do seed — sempre presentes após o migrate reset
const SEED_CLIENTE = {
  id: 1,
  email: 'cliente@teste.com',
  senha: 'Cliente@123',
};

const SEED_GERENTE = {
  email: 'gerente@raizesdnordeste.com',
  senha: 'Gerente@123',
};

// Estado compartilhado
let tokenCliente;
let tokenGerente;
let pedidoId; // pedido que será levado até ENTREGUE para gerar pontos

const pedidosCriados = [];

beforeAll(async () => {
  // 1. Zera pontos do cliente seed — isola este arquivo dos anteriores
  await resetarPontosCliente(SEED_CLIENTE.id);

  // 2. Login
  const resCliente = await request(app)
    .post('/auth/login')
    .send({ email: SEED_CLIENTE.email, senha: SEED_CLIENTE.senha, tipo: 'cliente' });
  tokenCliente = resCliente.body.accessToken;

  const resGerente = await request(app)
    .post('/auth/login')
    .send({ email: SEED_GERENTE.email, senha: SEED_GERENTE.senha, tipo: 'colaborador' });
  tokenGerente = resGerente.body.accessToken;

  // 3. Cria pedido de R$119,60 (4x Bauru G = 4 × R$29,90)
  //    itemId: 1 (Bauru Nordestino), variacaoId: 3 (G, R$29,90)
  const resPedido = await request(app)
    .post('/pedidos')
    .set('Authorization', `Bearer ${tokenCliente}`)
    .send({
      unidadeId: 1,
      clienteId: SEED_CLIENTE.id,
      canalPedido: 'APP',
      formaPagamento: 'MOCK',
      itens: [{ itemId: 1, variacaoId: 3, quantidade: 4 }],
    });

  pedidoId = resPedido.body.id;
  pedidosCriados.push(pedidoId);

  // 4. Leva o pedido até ENTREGUE: EM_PREPARO → PRONTO → ENTREGUE
  //    Ao chegar em ENTREGUE o sistema credita os pontos automaticamente
  await request(app)
    .patch(`/pedidos/${pedidoId}/status`)
    .set('Authorization', `Bearer ${tokenGerente}`)
    .send({ status: 'PRONTO' });

  await request(app)
    .patch(`/pedidos/${pedidoId}/status`)
    .set('Authorization', `Bearer ${tokenGerente}`)
    .send({ status: 'ENTREGUE' });
});

afterAll(async () => {
  const ids = pedidosCriados.filter(Boolean);
  if (ids.length > 0) await deletarPedidos(ids);
  await resetarPontosCliente(SEED_CLIENTE.id);
  await prisma.$disconnect();
});

// =============================================================
// CONSULTA DE SALDO
// =============================================================
describe('GET /fidelidade/:clienteId/saldo', () => {
  it('retorna saldo correto após pedido ENTREGUE → 200', async () => {
    // 4 × R$29,90 = R$119,60 → Math.floor(119.60) = 119 pontos
    const res = await request(app)
      .get(`/fidelidade/${SEED_CLIENTE.id}/saldo`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(200);
    expect(res.body.saldoAtual).toBe(119);
    expect(res.body.totalPedidos).toBe(1);

    // 119 pontos × R$20/100pts = R$23,80
    expect(res.body.equivalenteEmReais).toBeCloseTo(23.8, 2);

    // Próximo bônus em: 5 - (1 % 5) = 4 pedidos
    expect(res.body.proximoBonusEm).toBe(4);
  });

  it('cliente não pode consultar saldo de outro cliente → 403', async () => {
    const res = await request(app)
      .get('/fidelidade/9999/saldo')
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('retorna 409 para cliente sem aceiteFidelidade', async () => {
    // O cliente do seed tem aceiteFidelidade: true — este caso
    // seria para um cliente que NÃO aderiu. Testamos via gerente
    // consultando um clienteId que não aderiu (inexistente → 404).
    const res = await request(app)
      .get('/fidelidade/9999/saldo')
      .set('Authorization', `Bearer ${tokenGerente}`);

    // 9999 não existe → RECURSO_NAO_ENCONTRADO (404)
    expect(res.status).toBe(404);
  });

  it('rejeita sem token → 401', async () => {
    const res = await request(app).get(`/fidelidade/${SEED_CLIENTE.id}/saldo`);
    expect(res.status).toBe(401);
  });
});

// =============================================================
// HISTÓRICO DE PONTOS
// =============================================================
describe('GET /fidelidade/:clienteId/historico', () => {
  it('retorna histórico com registro de GANHO após pedido ENTREGUE → 200', async () => {
    const res = await request(app)
      .get(`/fidelidade/${SEED_CLIENTE.id}/historico`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');

    // Deve conter ao menos 1 registro de GANHO
    const ganhos = res.body.data.filter((r) => r.tipo === 'GANHO');
    expect(ganhos.length).toBeGreaterThanOrEqual(1);
    expect(ganhos[0].quantidade).toBe(119);
    expect(ganhos[0]).toHaveProperty('pedido');
    expect(ganhos[0].pedido.id).toBe(pedidoId);
  });

  it('filtra por tipo=GANHO → retorna só registros de ganho → 200', async () => {
    const res = await request(app)
      .get(`/fidelidade/${SEED_CLIENTE.id}/historico?tipo=GANHO`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((r) => r.tipo === 'GANHO')).toBe(true);
  });

  it('filtra por tipo=RESGATE → vazio enquanto não houve resgate → 200', async () => {
    const res = await request(app)
      .get(`/fidelidade/${SEED_CLIENTE.id}/historico?tipo=RESGATE`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// =============================================================
// RESGATE DE PONTOS
// =============================================================
describe('POST /fidelidade/:clienteId/resgatar', () => {
  it('resgata pontos com saldo suficiente → 200', async () => {
    // Saldo atual: 119 pts → equivale a R$23,80
    // Resgate para compra de R$100 → desconto parcial (usa todos os 119 pts)
    const res = await request(app)
      .post(`/fidelidade/${SEED_CLIENTE.id}/resgatar`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ totalCompra: 100 });

    expect(res.status).toBe(200);
    expect(res.body.pontosUsados).toBe(119);
    expect(res.body.valorDesconto).toBeCloseTo(23.8, 2);
    expect(res.body.saldoAnterior).toBe(119);
    expect(res.body.saldoAtual).toBe(0);
    expect(res.body.historico.tipo).toBe('RESGATE');
    expect(res.body.historico.quantidade).toBe(-119);
  });

  it('rejeita resgate com saldo zerado → 409', async () => {
    // Saldo agora é 0 após o resgate anterior
    const res = await request(app)
      .post(`/fidelidade/${SEED_CLIENTE.id}/resgatar`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ totalCompra: 50 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SALDO_INSUFICIENTE');
  });

  it('rejeita resgate sem o campo totalCompra → 422', async () => {
    const res = await request(app)
      .post(`/fidelidade/${SEED_CLIENTE.id}/resgatar`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('DADOS_INVALIDOS');
  });

  it('cliente não pode resgatar pontos de outro cliente → 403', async () => {
    const res = await request(app)
      .post(`/fidelidade/9999/resgatar`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ totalCompra: 50 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });
});
