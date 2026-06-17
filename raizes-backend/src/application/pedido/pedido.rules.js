const { AppError } = require('../../domain/errors');

/**
 * Diagrama de transições válidas de status de pedido:
 *
 *   AGUARDANDO_PAGAMENTO ──► EM_PREPARO ──► PRONTO ──► ENTREGUE
 *         │                      │             │
 *         └──────────────────────┴─────────────┴──► CANCELADO
 *
 * ENTREGUE e CANCELADO são estados terminais: nenhuma transição é permitida.
 */
const TRANSICOES_STATUS = {
  AGUARDANDO_PAGAMENTO: ['EM_PREPARO', 'CANCELADO'],
  EM_PREPARO:           ['PRONTO', 'CANCELADO'],
  PRONTO:               ['ENTREGUE', 'CANCELADO'],
  ENTREGUE:             [],
  CANCELADO:            [],
};

/**
 * Valida se a transição statusAtual → statusNovo é permitida.
 * Lança AppError 409 TRANSICAO_STATUS_INVALIDA se não for.
 */
function validarTransicaoStatus(statusAtual, statusNovo) {
  const permitidos = TRANSICOES_STATUS[statusAtual] ?? [];

  if (!permitidos.includes(statusNovo)) {
    throw new AppError(
      `Transição de status inválida: ${statusAtual} → ${statusNovo}. Permitidos: ${permitidos.join(', ') || 'nenhum'}.`,
      409,
      'TRANSICAO_STATUS_INVALIDA',
      [{ field: 'status', issue: `De "${statusAtual}" só é possível ir para: ${permitidos.join(', ') || 'nenhum'}.` }]
    );
  }
}

module.exports = { validarTransicaoStatus, TRANSICOES_STATUS };
