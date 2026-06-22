/**
 * Testes de integração — Pedidos
 *
 * O que testamos aqui:
 *  - POST /pedidos             → criação, validações, idempotência
 *  - GET  /pedidos/:id         → busca por ID, controle de acesso
 *  - PATCH /pedidos/:id/status → transições de status (EM_PREPARO → PRONTO → ENTREGUE)
 *  - DELETE /pedidos/:id/cancelar → cancelamento
 *  - GET /pedidos/:id/logs     → auditoria
 *
 * Estratégia de isolamento:
 *  - Criamos um cliente exclusivo para estes testes (não o seed "cliente@teste.com").
 *    Isso isola os dados de fidelidade: a seed client fica limpa para o 3-fidelidade.test.js.
 *  - PAYMENT_MOCK_MODE=always_approve garante que pagamentos sempre aprovam.
 *  - Usamos canalPedido diferentes em cada criação para evitar a janela de idempotência (30s).
 *  - afterAll limpa pedidos e cliente criados durante o teste.
 */
const request = require('supertest');
const app = require('../app');
const { prisma, deletarPedidos, deletarClientePorEmail } = require('./helpers/db');

// Estado compartilhado entre os describes (preenchido no beforeAll)
let tokenGerente;
let tokenCliente;
let clienteId;
let pedidoIdBase;      // pedido para testes de GET
let pedidoIdStatus;    // pedido para testes de transição de status
let pedidoIdCancelar;  // pedido para teste de cancelamento

const pedidosCriados = []; // IDs acumulados para cleanup

// Cliente exclusivo deste arquivo de testes
const CLIENTE_PEDIDOS = {
  nome: 'Tester Pedidos',
  email: 'pedidos_tester@raizes.test',
  cpf: '66677788800',
  senha: 'Teste@123',
  aceiteLgpd: true,
  aceiteFidelidade: true,
};

// Payload base de pedido: 1x Bauru Nordestino Pequeno (R$18,90)
// itemId: 1, variacaoId: 1 (tamanho P, R$18.90) — definidos no seed
const PAYLOAD_PEDIDO = {
  unidadeId: 1,
  formaPagamento: 'MOCK',
  itens: [{ itemId: 1, variacaoId: 1, quantidade: 1 }],
};

// Cria pedido e registra o ID para cleanup
async function criarPedido(canal) {
  const res = await request(app)
    .post('/pedidos')
    .set('Authorization', `Bearer ${tokenCliente}`)
    .send({ ...PAYLOAD_PEDIDO, clienteId, canalPedido: canal });

  if (res.body.id) pedidosCriados.push(res.body.id);
  return res;
}

// =============================================================
// SETUP E TEARDOWN GLOBAIS DO ARQUIVO
// =============================================================

beforeAll(async () => {
  // 1. Login como gerente (para ações administrativas)
  const resGerente = await request(app)
    .post('/auth/login')
    .send({ email: 'gerente@raizesdnordeste.com', senha: 'Gerente@123', tipo: 'colaborador' });
  tokenGerente = resGerente.body.accessToken;

  // 2. Registrar cliente exclusivo para estes testes
  const resRegistro = await request(app)
    .post('/auth/register')
    .send(CLIENTE_PEDIDOS);
  clienteId = resRegistro.body.id;

  // 3. Login como o cliente recém-criado
  const resCliente = await request(app)
    .post('/auth/login')
    .send({ email: CLIENTE_PEDIDOS.email, senha: CLIENTE_PEDIDOS.senha, tipo: 'cliente' });
  tokenCliente = resCliente.body.accessToken;

  // 4. Cria pedidos iniciais para os testes de GET e status
  //    Canais diferentes para não cair na janela de idempotência (30s)
  const resPedidoBase = await criarPedido('WEB');
  pedidoIdBase = resPedidoBase.body.id;

  const resPedidoStatus = await criarPedido('APP');
  pedidoIdStatus = resPedidoStatus.body.id;

  const resPedidoCancelar = await criarPedido('TOTEM');
  pedidoIdCancelar = resPedidoCancelar.body.id;
});

afterAll(async () => {
  const ids = pedidosCriados.filter(Boolean);
  if (ids.length > 0) await deletarPedidos(ids);
  await deletarClientePorEmail(CLIENTE_PEDIDOS.email);
  await prisma.$disconnect();
});

// =============================================================
// CRIAÇÃO DE PEDIDOS
// =============================================================
describe('POST /pedidos', () => {
  it('pedido criado tem status EM_PREPARO (pagamento aprovado) → 201', async () => {
    // PAYMENT_MOCK_MODE=always_approve: todo pedido aprovado vai para EM_PREPARO
    const res = await criarPedido('BALCAO');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('EM_PREPARO');
    expect(res.body.pagamento.status).toBe('APROVADO');
    expect(res.body.pagamentoResultado.status).toBe('APROVADO');
    expect(Number(res.body.total)).toBeCloseTo(18.90, 2);
  });

  it('retorna o shape completo do pedido → 201', async () => {
    const res = await criarPedido('PICKUP');

    expect(res.status).toBe(201);
    // Verifica os blocos principais da resposta
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('itensPedido');
    expect(res.body).toHaveProperty('pagamento');
    expect(res.body).toHaveProperty('unidade');
    expect(res.body).toHaveProperty('cliente');
    expect(res.body.unidade.id).toBe(1);
    expect(res.body.cliente.email).toBe(CLIENTE_PEDIDOS.email);
  });

  it('idempotência: mesma combinação dentro de 30s retorna pedido existente → 201', async () => {
    // Cria pedido com canal "BALCAO" — já existe um acima
    // O service deve detectar o pedido recente e devolvê-lo sem criar novo
    const res1 = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ...PAYLOAD_PEDIDO, clienteId, canalPedido: 'WEB' });

    // Faz a mesma requisição imediatamente
    const res2 = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ...PAYLOAD_PEDIDO, clienteId, canalPedido: 'WEB' });

    // Ambas devem retornar 201 e o mesmo ID de pedido
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.id).toBe(res2.body.id);
  });

  it('rejeita requisição sem token de autenticação → 401', async () => {
    const res = await request(app)
      .post('/pedidos')
      .send({ ...PAYLOAD_PEDIDO, clienteId, canalPedido: 'WEB' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NAO_AUTENTICADO');
  });

  it('rejeita unidade inexistente → 404', async () => {
    const res = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ...PAYLOAD_PEDIDO, clienteId, canalPedido: 'WEB', unidadeId: 9999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('RECURSO_NAO_ENCONTRADO');
  });
});

// =============================================================
// BUSCA DE PEDIDO POR ID
// =============================================================
describe('GET /pedidos/:id', () => {
  it('retorna pedido para o cliente dono → 200', async () => {
    const res = await request(app)
      .get(`/pedidos/${pedidoIdBase}`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(pedidoIdBase);
    expect(res.body.cliente.email).toBe(CLIENTE_PEDIDOS.email);
  });

  it('retorna pedido para o gerente da unidade → 200', async () => {
    const res = await request(app)
      .get(`/pedidos/${pedidoIdBase}`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(pedidoIdBase);
  });

  it('retorna 404 para ID inexistente → 404', async () => {
    const res = await request(app)
      .get('/pedidos/999999')
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('RECURSO_NAO_ENCONTRADO');
  });

  it('rejeita sem token → 401', async () => {
    const res = await request(app).get(`/pedidos/${pedidoIdBase}`);
    expect(res.status).toBe(401);
  });
});

// =============================================================
// ATUALIZAÇÃO DE STATUS
// Fluxo testado: EM_PREPARO → PRONTO → ENTREGUE
// Cada teste depende do anterior (pedidoIdStatus evolui de estado)
// =============================================================
describe('PATCH /pedidos/:id/status', () => {
  it('gerente atualiza EM_PREPARO → PRONTO → 200', async () => {
    const res = await request(app)
      .patch(`/pedidos/${pedidoIdStatus}/status`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ status: 'PRONTO' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PRONTO');
  });

  it('gerente atualiza PRONTO → ENTREGUE → 200', async () => {
    const res = await request(app)
      .patch(`/pedidos/${pedidoIdStatus}/status`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ status: 'ENTREGUE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ENTREGUE');
  });

  it('transição inválida: ENTREGUE → CANCELADO → 409', async () => {
    // Pedido já está ENTREGUE — não pode mais ser cancelado
    const res = await request(app)
      .patch(`/pedidos/${pedidoIdStatus}/status`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ status: 'CANCELADO' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('TRANSICAO_STATUS_INVALIDA');
  });

  it('cliente não pode atualizar status → 403', async () => {
    const res = await request(app)
      .patch(`/pedidos/${pedidoIdBase}/status`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ status: 'PRONTO' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });
});

// =============================================================
// CANCELAMENTO
// =============================================================
describe('DELETE /pedidos/:id/cancelar', () => {
  it('cliente cancela o próprio pedido → 200', async () => {
    const res = await request(app)
      .delete(`/pedidos/${pedidoIdCancelar}/cancelar`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ motivo: 'Teste de cancelamento' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADO');
  });

  it('pedido já cancelado não pode ser cancelado novamente → 409', async () => {
    const res = await request(app)
      .delete(`/pedidos/${pedidoIdCancelar}/cancelar`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('TRANSICAO_STATUS_INVALIDA');
  });
});

// =============================================================
// LOGS DE AUDITORIA
// =============================================================
describe('GET /pedidos/:id/logs', () => {
  it('retorna histórico de transições de status para gerente → 200', async () => {
    // pedidoIdStatus passou por: AGUARDANDO_PAGAMENTO → EM_PREPARO → PRONTO → ENTREGUE
    const res = await request(app)
      .get(`/pedidos/${pedidoIdStatus}/logs`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3); // ao menos 3 transições

    // Primeira entrada: criação do pedido (statusAntes: null)
    expect(res.body[0].statusAntes).toBeNull();
    expect(res.body[0].statusDepois).toBe('AGUARDANDO_PAGAMENTO');

    // Última entrada: ENTREGUE
    const ultimoLog = res.body[res.body.length - 1];
    expect(ultimoLog.statusDepois).toBe('ENTREGUE');
  });

  it('cliente não pode ver logs → 403', async () => {
    const res = await request(app)
      .get(`/pedidos/${pedidoIdStatus}/logs`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(403);
  });
});

// =============================================================
// T21 — CONTROLE DE ACESSO ENTRE CLIENTES (IDOR)
// Garante que um CLIENTE autenticado não acessa dados de outro.
// =============================================================
describe('T21 — IDOR: cliente não acessa pedidos de outro cliente', () => {
  // Cliente B exclusivo deste bloco
  const CLIENTE_B = {
    nome: 'Tester IDOR B',
    email: 'idor_b@raizes.test',
    cpf: '11122233344',
    senha: 'Teste@123',
    aceiteLgpd: true,
    aceiteFidelidade: false,
  };

  let tokenClienteB;
  let clienteIdB;
  let pedidoClienteB; // pedido criado pelo cliente B

  beforeAll(async () => {
    // Registra e faz login como cliente B
    const resRegistro = await request(app).post('/auth/register').send(CLIENTE_B);
    clienteIdB = resRegistro.body.id;

    const resLogin = await request(app)
      .post('/auth/login')
      .send({ email: CLIENTE_B.email, senha: CLIENTE_B.senha, tipo: 'cliente' });
    tokenClienteB = resLogin.body.accessToken;

    // Cliente B cria um pedido próprio
    const resPedido = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenClienteB}`)
      .send({ ...PAYLOAD_PEDIDO, canalPedido: 'APP' });
    pedidoClienteB = resPedido.body.id;
  });

  afterAll(async () => {
    if (pedidoClienteB) await deletarPedidos([pedidoClienteB]);
    await deletarClientePorEmail(CLIENTE_B.email);
  });

  it('POST /pedidos: clienteId do body é ignorado — pedido é criado para o próprio cliente → 201', async () => {
    // Cliente A tenta criar um pedido passando o ID do cliente B no body
    const res = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ...PAYLOAD_PEDIDO, clienteId: clienteIdB, canalPedido: 'TOTEM' });

    expect(res.status).toBe(201);
    // O pedido deve ter sido criado para o cliente A, não para o B
    expect(res.body.cliente.id).toBe(clienteId);
    expect(res.body.cliente.id).not.toBe(clienteIdB);

    if (res.body.id) pedidosCriados.push(res.body.id);
  });

  it('GET /pedidos: cliente A não vê pedidos do cliente B na listagem → 200 sem dados alheios', async () => {
    const res = await request(app)
      .get('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(200);
    // Todos os pedidos retornados devem pertencer ao cliente A
    const idsClientes = res.body.data.map((p) => p.cliente?.id);
    expect(idsClientes.every((id) => id === clienteId)).toBe(true);
  });

  it('GET /pedidos/:id: cliente A não consegue ver o pedido do cliente B → 403', async () => {
    const res = await request(app)
      .get(`/pedidos/${pedidoClienteB}`)
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('GET /pedidos/:id: cliente B consegue ver o próprio pedido → 200', async () => {
    const res = await request(app)
      .get(`/pedidos/${pedidoClienteB}`)
      .set('Authorization', `Bearer ${tokenClienteB}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(pedidoClienteB);
  });
});
