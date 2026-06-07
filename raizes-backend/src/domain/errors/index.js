class AppError extends Error {
  constructor(message, statusCode, code, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class EstoqueInsuficienteError extends AppError {
  constructor(details = []) {
    super('Não há quantidade suficiente para um ou mais itens.', 409, 'ESTOQUE_INSUFICIENTE', details);
  }
}

class PagamentoRecusadoError extends AppError {
  constructor() {
    super('Pagamento recusado pelo serviço de pagamento.', 200, 'PAGAMENTO_RECUSADO');
  }
}

class RecursoNaoEncontradoError extends AppError {
  constructor(recurso = 'Recurso') {
    super(`${recurso} não encontrado.`, 404, 'RECURSO_NAO_ENCONTRADO');
  }
}

class CanalInvalidoError extends AppError {
  constructor() {
    super('O campo canalPedido é obrigatório e deve ser: APP, WEB, TOTEM, BALCAO ou PICKUP.', 422, 'CANAL_INVALIDO', [
      { field: 'canalPedido', issue: 'Valor ausente ou inválido.' },
    ]);
  }
}

class PagamentoJaProcessadoError extends AppError {
  constructor() {
    super('Este pedido já possui um pagamento registrado.', 409, 'PAGAMENTO_JA_PROCESSADO');
  }
}

class VoucherInvalidoError extends AppError {
  constructor(motivo) {
    super(`Voucher inválido: ${motivo}`, 422, 'VOUCHER_INVALIDO', [
      { field: 'voucher', issue: motivo },
    ]);
  }
}

module.exports = {
  AppError,
  EstoqueInsuficienteError,
  PagamentoRecusadoError,
  RecursoNaoEncontradoError,
  CanalInvalidoError,
  PagamentoJaProcessadoError,
  VoucherInvalidoError,
};
