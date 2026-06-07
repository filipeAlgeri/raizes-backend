// Simula um gateway externo de pagamento
// Modos: "always_approve" | "always_reject" | "random"

function processarPagamentoMock({ pedidoId, valor, formaPagamento, clienteId }) {
  const modo = process.env.PAYMENT_MOCK_MODE || 'random';

  let aprovado;

  if (modo === 'always_approve') {
    aprovado = true;
  } else if (modo === 'always_reject') {
    aprovado = false;
  } else {
    aprovado = Math.random() > 0.2; // 80% de aprovação
  }

  if (aprovado) {
    return {
      status: 'APROVADO',
      transacaoId: `MOCK-${Date.now()}-${pedidoId}`,
      mensagem: 'Pagamento aprovado com sucesso.',
      processadoEm: new Date().toISOString(),
    };
  }

  return {
    status: 'RECUSADO',
    transacaoId: null,
    mensagem: 'Pagamento recusado. Verifique os dados e tente novamente.',
    processadoEm: new Date().toISOString(),
  };
}

module.exports = { processarPagamentoMock };
