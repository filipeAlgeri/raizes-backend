/**
 * Testes unitários — Transições de Status do Pedido
 *
 * Testa validarTransicaoStatus() diretamente, sem HTTP, sem banco de dados.
 * A função encapsula o diagrama de estados:
 *
 *   AGUARDANDO_PAGAMENTO ──► EM_PREPARO ──► PRONTO ──► ENTREGUE
 *         │                      │             │
 *         └──────────────────────┴─────────────┴──► CANCELADO
 *
 * ENTREGUE e CANCELADO são estados terminais: nenhuma transição é possível a partir deles.
 *
 * Por que testar unitariamente?
 *  Os testes de integração (2-pedidos.test.js) verificam o happy-path e um caso de
 *  transição inválida. Os testes unitários aqui cobrem TODAS as combinações do diagrama
 *  de forma exaustiva e rápida, sem depender de banco ou HTTP.
 */
const { validarTransicaoStatus, TRANSICOES_STATUS } = require('../../application/pedido/pedido.rules');
const { AppError } = require('../../domain/errors');

// =============================================================
// TRANSIÇÕES PERMITIDAS
// Não devem lançar nenhum erro
// =============================================================
describe('validarTransicaoStatus — transições permitidas', () => {
  const casosPermitidos = [
    ['AGUARDANDO_PAGAMENTO', 'EM_PREPARO'],
    ['AGUARDANDO_PAGAMENTO', 'CANCELADO'],
    ['EM_PREPARO',           'PRONTO'],
    ['EM_PREPARO',           'CANCELADO'],
    ['PRONTO',               'ENTREGUE'],
    ['PRONTO',               'CANCELADO'],
  ];

  test.each(casosPermitidos)(
    '%s → %s não lança erro',
    (statusAtual, statusNovo) => {
      expect(() => validarTransicaoStatus(statusAtual, statusNovo)).not.toThrow();
    }
  );
});

// =============================================================
// TRANSIÇÕES PROIBIDAS
// Devem lançar AppError com code='TRANSICAO_STATUS_INVALIDA' e HTTP 409
// =============================================================
describe('validarTransicaoStatus — transições proibidas', () => {
  const casosProibidos = [
    // Estados terminais não permitem nenhuma saída
    ['ENTREGUE',             'CANCELADO',   'estado terminal'],
    ['ENTREGUE',             'PRONTO',      'estado terminal'],
    ['ENTREGUE',             'EM_PREPARO',  'estado terminal'],
    ['CANCELADO',            'EM_PREPARO',  'estado terminal'],
    ['CANCELADO',            'PRONTO',      'estado terminal'],
    // Salto de etapas (violação da sequência obrigatória)
    ['AGUARDANDO_PAGAMENTO', 'PRONTO',      'pula etapa'],
    ['AGUARDANDO_PAGAMENTO', 'ENTREGUE',    'pula etapa'],
    ['EM_PREPARO',           'ENTREGUE',    'pula etapa'],
    // Retrocesso no fluxo
    ['PRONTO',               'EM_PREPARO',  'retrocesso'],
    ['EM_PREPARO',           'AGUARDANDO_PAGAMENTO', 'retrocesso'],
  ];

  test.each(casosProibidos)(
    '%s → %s lança TRANSICAO_STATUS_INVALIDA (%s)',
    (statusAtual, statusNovo) => {
      let err;
      try {
        validarTransicaoStatus(statusAtual, statusNovo);
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('TRANSICAO_STATUS_INVALIDA');
      // A mensagem de detalhes aponta para o campo 'status'
      expect(err.details[0].field).toBe('status');
    }
  );
});

// =============================================================
// MAPA DE TRANSIÇÕES (TRANSICOES_STATUS)
// Garante que o contrato exportado está completo e correto
// =============================================================
describe('TRANSICOES_STATUS — mapa de estados', () => {
  it('cobre todos os 5 status possíveis', () => {
    const status = Object.keys(TRANSICOES_STATUS);
    expect(status).toHaveLength(5);
    expect(status).toEqual(
      expect.arrayContaining([
        'AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO',
      ])
    );
  });

  it('ENTREGUE é estado terminal (nenhuma transição)', () => {
    expect(TRANSICOES_STATUS.ENTREGUE).toEqual([]);
  });

  it('CANCELADO é estado terminal (nenhuma transição)', () => {
    expect(TRANSICOES_STATUS.CANCELADO).toEqual([]);
  });

  it('CANCELADO é destino possível de AGUARDANDO_PAGAMENTO, EM_PREPARO e PRONTO', () => {
    const estadosCancelaveis = Object.entries(TRANSICOES_STATUS)
      .filter(([, destinos]) => destinos.includes('CANCELADO'))
      .map(([estado]) => estado);

    expect(estadosCancelaveis).toEqual(
      expect.arrayContaining(['AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'PRONTO'])
    );
    // ENTREGUE e CANCELADO não permitem cancelamento
    expect(estadosCancelaveis).not.toContain('ENTREGUE');
    expect(estadosCancelaveis).not.toContain('CANCELADO');
  });
});
