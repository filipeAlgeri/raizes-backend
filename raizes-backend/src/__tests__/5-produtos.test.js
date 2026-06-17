/**
 * Testes de integração — Produtos (Cardápio Mestre)
 *
 * O que testamos aqui:
 *  - GET    /produtos       → listar produtos aprovados (rota pública, sem auth)
 *  - GET    /produtos/:id   → detalhar produto (rota pública)
 *  - POST   /produtos       → criar produto (ADMIN/MARKETING/GERENTE)
 *  - PUT    /produtos/:id   → atualizar produto (ADMIN/MARKETING)
 *  - DELETE /produtos/:id   → remover produto — soft-delete (ADMIN apenas)
 *
 * Estratégia de isolamento:
 *  - Produtos criados durante os testes são rastreados em produtosCriados[].
 *  - afterAll deleta as variacoes primeiro (FK constraint) e então os itens.
 *  - O seed tem 3 produtos APROVADOS (ids 1, 2, 3). Não os tocamos.
 *
 * Comportamentos importantes verificados:
 *  - GERENTE cria produto com status=PENDENTE (produto de unidade aguarda aprovação).
 *  - ADMIN (central, sem unidadeId) cria com status=APROVADO.
 *  - DELETE é soft-delete: seta status=REJEITADO; produto some do GET /produtos
 *    (que filtra por status=APROVADO por padrão) mas o registro persiste no banco.
 *  - Schema de validação (Zod): variacoes é obrigatório e deve ter ao menos 1 item.
 *
 * Roles verificadas:
 *  POST   : ADMIN ✓, GERENTE ✓ (cria PENDENTE), sem token → 401
 *  PUT    : ADMIN ✓, GERENTE → 403
 *  DELETE : ADMIN ✓, GERENTE → 403
 */
const request = require('supertest');
const app = require('../app');
const { prisma } = require('./helpers/db');

let tokenAdmin;
let tokenGerente;
const produtosCriados = []; // IDs rastreados para cleanup no afterAll

const PAYLOAD_PRODUTO = {
  nome: 'Produto Teste Jest',
  descricao: 'Produto criado automaticamente pelo teste de integração',
  categoria: 'BEBIDA',
  variacoes: [{ tamanho: 'U', preco: 9.90 }],
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
});

afterAll(async () => {
  // Deleta dependências antes do item para não violar FK constraints
  if (produtosCriados.length > 0) {
    await prisma.variacaoItem.deleteMany({ where: { itemId: { in: produtosCriados } } });
    await prisma.itemCardapio.deleteMany({ where: { id: { in: produtosCriados } } });
  }
  await prisma.$disconnect();
});

// =============================================================
// LISTAGEM DE PRODUTOS (pública — sem autenticação)
// =============================================================
describe('GET /produtos', () => {
  it('lista produtos aprovados sem token → 200 + shape paginado', async () => {
    const res = await request(app).get('/produtos');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);

    // Seed tem 3 produtos APROVADOS
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);

    const produto = res.body.data[0];
    expect(produto).toHaveProperty('id');
    expect(produto).toHaveProperty('nome');
    expect(produto).toHaveProperty('categoria');
    expect(produto).toHaveProperty('variacoes');
    expect(Array.isArray(produto.variacoes)).toBe(true);
  });

  it('filtra por categoria=BEBIDA → retorna somente bebidas → 200', async () => {
    // Seed tem 1 BEBIDA: Suco Natural (id=3)
    const res = await request(app).get('/produtos?categoria=BEBIDA');

    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.categoria === 'BEBIDA')).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================
// DETALHE DE PRODUTO (público — sem autenticação)
// =============================================================
describe('GET /produtos/:id', () => {
  it('retorna o Bauru Nordestino (id=1) com todas as variações → 200', async () => {
    const res = await request(app).get('/produtos/1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.nome).toBe('Bauru Nordestino');
    expect(res.body.categoria).toBe('LANCHE');
    expect(res.body).toHaveProperty('descricao');
    expect(res.body).toHaveProperty('status');

    // Seed cria 3 variações (P, M, G) — retornadas ordenadas por preço (asc)
    expect(res.body.variacoes.length).toBe(3);
    expect(Number(res.body.variacoes[0].preco)).toBeLessThan(
      Number(res.body.variacoes[1].preco)
    );
  });

  it('produto inexistente → 404', async () => {
    const res = await request(app).get('/produtos/9999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('RECURSO_NAO_ENCONTRADO');
  });
});

// =============================================================
// CRIAÇÃO DE PRODUTO
// =============================================================
describe('POST /produtos', () => {
  it('admin central cria produto → 201 + status APROVADO', async () => {
    // Admin não tem unidadeId → criadoPorUnidadeId=null → produto APROVADO automaticamente
    const res = await request(app)
      .post('/produtos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(PAYLOAD_PRODUTO);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.nome).toBe(PAYLOAD_PRODUTO.nome);
    expect(res.body.status).toBe('APROVADO');
    expect(res.body.variacoes.length).toBe(1);
    expect(Number(res.body.variacoes[0].preco)).toBeCloseTo(9.90, 2);

    produtosCriados.push(res.body.id);
  });

  it('gerente cria produto → 201 + status PENDENTE (aguarda aprovação da central)', async () => {
    // Gerente tem unidadeId → criadoPorUnidadeId é preenchido → produto criado como PENDENTE
    const res = await request(app)
      .post('/produtos')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ ...PAYLOAD_PRODUTO, nome: 'Produto Pendente Jest' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDENTE');

    produtosCriados.push(res.body.id);
  });

  it('produto sem variações → 422 VALIDACAO_INVALIDA (Zod: min 1 variação)', async () => {
    // O middleware validar(produtoSchema) rejeita antes de chegar no service
    const res = await request(app)
      .post('/produtos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...PAYLOAD_PRODUTO, variacoes: [] });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDACAO_INVALIDA');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'variacoes' })])
    );
  });

  it('sem token → 401', async () => {
    const res = await request(app).post('/produtos').send(PAYLOAD_PRODUTO);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NAO_AUTENTICADO');
  });
});

// =============================================================
// ATUALIZAÇÃO DE PRODUTO
// =============================================================
describe('PUT /produtos/:id', () => {
  let produtoIdParaEditar;

  beforeAll(async () => {
    // Produto dedicado a este bloco — não mistura estado com o describe de POST
    const res = await request(app)
      .post('/produtos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...PAYLOAD_PRODUTO, nome: 'Produto Para Editar Jest' });
    produtoIdParaEditar = res.body.id;
    produtosCriados.push(produtoIdParaEditar);
  });

  it('admin atualiza nome e variações → 200 + dados atualizados', async () => {
    const res = await request(app)
      .put(`/produtos/${produtoIdParaEditar}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: 'Produto Editado Jest',
        categoria: 'BEBIDA',
        variacoes: [
          { tamanho: 'P', preco: 5.50 },
          { tamanho: 'G', preco: 11.90 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Produto Editado Jest');
    // atualizarProduto deleta e recria as variações
    expect(res.body.variacoes.length).toBe(2);
  });

  it('gerente não tem permissão para PUT → 403', async () => {
    // PUT é restrito a ADMIN e MARKETING — GERENTE recebe SEM_PERMISSAO
    const res = await request(app)
      .put(`/produtos/${produtoIdParaEditar}`)
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send(PAYLOAD_PRODUTO);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('produto inexistente → 404', async () => {
    const res = await request(app)
      .put('/produtos/9999')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(PAYLOAD_PRODUTO);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('RECURSO_NAO_ENCONTRADO');
  });
});

// =============================================================
// REMOÇÃO DE PRODUTO (soft-delete: status → REJEITADO)
// =============================================================
describe('DELETE /produtos/:id', () => {
  let produtoIdParaRemover;

  beforeAll(async () => {
    const res = await request(app)
      .post('/produtos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...PAYLOAD_PRODUTO, nome: 'Produto Para Remover Jest' });
    produtoIdParaRemover = res.body.id;
    produtosCriados.push(produtoIdParaRemover);
  });

  it('gerente não tem permissão para DELETE → 403', async () => {
    // DELETE é exclusivo do ADMIN
    const res = await request(app)
      .delete(`/produtos/${produtoIdParaRemover}`)
      .set('Authorization', `Bearer ${tokenGerente}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });

  it('admin remove produto (soft-delete) → 204 + produto some da listagem', async () => {
    // removerProduto() seta status=REJEITADO (não apaga o registro)
    const deleteRes = await request(app)
      .delete(`/produtos/${produtoIdParaRemover}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(deleteRes.status).toBe(204);

    // Verifica que o produto deixou de aparecer no GET /produtos
    // (listarProdutos filtra por status=APROVADO por padrão)
    const listRes = await request(app).get('/produtos');
    const ids = listRes.body.data.map((p) => p.id);
    expect(ids).not.toContain(produtoIdParaRemover);
  });
});
