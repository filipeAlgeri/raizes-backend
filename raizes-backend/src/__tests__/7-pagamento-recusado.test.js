/**
 * Testes de integração — Pagamento Recusado
 *
 * Testa o caminho de recusa de pagamento dentro de criarPedido():
 *
 *   Transaction 1: estoque decrementado + pedido criado (commit)
 *        ↓
 *   processarPagamentoMock() → RECUSADO
 *        ↓
 *   Transaction 2: pagamento(RECUSADO) + status→CANCELADO + estoque revertido (commit)
 *
 * O resultado final para o cliente é:
 *  - HTTP 201 (o pedido foi criado — só cancelado logo depois)
 *  - res.body.status          = 'CANCELADO'
 *  - res.body.pagamento.status = 'RECUSADO'
 *  - estoque idêntico ao estado pré-pedido (revert confirmado)
 *
 * Técnica de isolamento:
 *  - PAYMENT_MOCK_MODE é sobrescrito para 'always_reject' antes de cada
 *    requisição de criação de pedido e restaurado para 'always_approve' após.
 *    Funciona porque --runInBand garante processo único/sequencial e o mock
 *    lê process.env.PAYMENT_MOCK_MODE em tempo de execução (não em import).
 *  - Usamos itemId=2 (Tapioca Recheada) — intocado por todos os arquivos
 *    anteriores — para verificar a reversão do estoque com saldo exato.
 */
const request = require('supertest');
const app = require('../app');
const { prisma, deletarPedidos, deletarClientePorEmail } = require('./helpers/db');

const CLIENTE_PAGAMENTO = {
  nome: 'Tester Pagamento Recusado',
  email: 'pagamento_recusado@raizes.test',
  cpf: '33344455500',
  senha: 'Teste@123',
  aceiteLgpd: true,
  aceiteFidelidade: false,
};

// itemId=2 (Tapioca Recheada), variacaoId=4 (P, R$10,00)
const PAYLOAD_PEDIDO = {
  unidadeId: 1,
  canalPedido: 'WEB',
  formaPagamento: 'MOCK',
  itens: [{ itemId: 2, variacaoId: 4, quantidade: 3 }],
};

let tokenCliente;
let tokenGerente;
let clienteId;
const pedidosCriados = [];

beforeAll(async () => {
  const resGerente = await request(app)
    .post('/auth/login')
    .send({ email: 'gerente@raizesdnordeste.com', senha: 'Gerente@123', tipo: 'colaborador' });
  tokenGerente = resGerente.body.accessToken;

  const resRegistro = await request(app)
    .post('/auth/register')
    .send(CLIENTE_PAGAMENTO);
  clienteId = resRegistro.body.id;

  const resCliente = await request(app)
    .post('/auth/login')
    .send({ email: CLIENTE_PAGAMENTO.email, senha: CLIENTE_PAGAMENTO.senha, tipo: 'cliente' });
  tokenCliente = resCliente.body.accessToken;
});

afterAll(async () => {
  const ids = pedidosCriados.filter(Boolean);
  if (ids.length > 0) await deletarPedidos(ids);
  await deletarClientePorEmail(CLIENTE_PAGAMENTO.email);
  await prisma.$disconnect();
});

// =============================================================
// CRIAÇÃO DE PEDIDO COM PAGAMENTO RECUSADO
// =============================================================
describe('POST /pedidos — pagamento recusado (PAYMENT_MOCK_MODE=always_reject)', () => {
  it('retorna 201 com status CANCELADO e pagamento RECUSADO', async () => {
    process.env.PAYMENT_MOCK_MODE = 'always_reject';

    const res = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ...PAYLOAD_PEDIDO, clienteId });

    process.env.PAYMENT_MOCK_MODE = 'always_approve';

    if (res.body.id) pedidosCriados.push(res.body.id);

    // API responde 201 mesmo com pagamento recusado — pedido foi criado (e logo cancelado)
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CANCELADO');

    // Registro de pagamento com status RECUSADO
    expect(res.body.pagamento.status).toBe('RECUSADO');
    expect(res.body.pagamento.transacaoId).toBeNull(); // mock não gera transacaoId ao recusar

    // Resultado do gateway no response
    expect(res.body.pagamentoResultado.status).toBe('RECUSADO');
    expect(typeof res.body.pagamentoResultado.mensagem).toBe('string');
  });

  it('estoque é revertido automaticamente após recusa — quantidade inalterada', async () => {
    // Captura saldo atual de itemId=2 (Tapioca, intocado pelos testes anteriores)
    const estoqueAntes = await request(app)
      .get('/unidades/1/estoque/2')
      .set('Authorization', `Bearer ${tokenGerente}`);
    const quantidadeAntes = estoqueAntes.body.quantidade;

    process.env.PAYMENT_MOCK_MODE = 'always_reject';

    const res = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ...PAYLOAD_PEDIDO, clienteId, canalPedido: 'APP' });

    process.env.PAYMENT_MOCK_MODE = 'always_approve';

    if (res.body.id) pedidosCriados.push(res.body.id);

    // Verifica reversão: quantidade deve ser idêntica à anterior ao pedido
    const estoqueDepois = await request(app)
      .get('/unidades/1/estoque/2')
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(estoqueDepois.body.quantidade).toBe(quantidadeAntes);
  });

  it('pedido cancelado por recusa não pode ser cancelado novamente → 409', async () => {
    process.env.PAYMENT_MOCK_MODE = 'always_reject';

    const resCriacao = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ...PAYLOAD_PEDIDO, clienteId, canalPedido: 'TOTEM' });

    process.env.PAYMENT_MOCK_MODE = 'always_approve';

    const pedidoId = resCriacao.body.id;
    if (pedidoId) pedidosCriados.push(pedidoId);

    // Pedido já está CANCELADO — CANCELADO é estado terminal, nenhuma transição é permitida
    const resCancelamento = await request(app)
      .delete(`/pedidos/${pedidoId}/cancelar`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ motivo: 'Tentativa de cancelar novamente' });

    expect(resCancelamento.status).toBe(409);
    expect(resCancelamento.body.error).toBe('TRANSICAO_STATUS_INVALIDA');
  });

  it('movimentação de estorno (ENTRADA) é registrada com pedidoId do pedido cancelado', async () => {
    process.env.PAYMENT_MOCK_MODE = 'always_reject';

    const res = await request(app)
      .post('/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ...PAYLOAD_PEDIDO, clienteId, canalPedido: 'BALCAO' });

    process.env.PAYMENT_MOCK_MODE = 'always_approve';

    const pedidoId = res.body.id;
    if (pedidoId) pedidosCriados.push(pedidoId);

    // O decremento (SAIDA) é criado antes do pedido ter ID → pedidoId=null no registro.
    // O estorno (ENTRADA) é criado na segunda transação, após o pedido existir → tem o ID correto.
    const movsRes = await request(app)
      .get('/unidades/1/estoque/movimentacoes?itemId=2&limit=50')
      .set('Authorization', `Bearer ${tokenGerente}`);

    const revert = movsRes.body.data.find((m) => m.tipo === 'ENTRADA' && m.pedidoId === pedidoId);

    expect(revert).toBeDefined();
    expect(revert.quantidade).toBe(3); // quantidade dos 3× Tapioca P decrementados e depois estornados
  });
});
