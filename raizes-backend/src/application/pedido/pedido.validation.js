const { z } = require('zod');

// Valores aceitos de acordo com o enum CanalPedido do schema
const CANAIS_VALIDOS = ['APP', 'WEB', 'TOTEM', 'BALCAO', 'PICKUP'];

// Formas de pagamento aceitas pelo sistema
const FORMAS_PAGAMENTO_VALIDAS = [
  'PIX',
  'CARTAO_CREDITO',
  'CARTAO_DEBITO',
  'VOUCHER',
  'DINHEIRO',
  'MOCK',
];

// Formas de pagamento permitidas apenas em canais presenciais
const FORMAS_SOMENTE_PRESENCIAL = ['DINHEIRO'];
const CANAIS_PRESENCIAIS = ['TOTEM', 'BALCAO'];

// Status permitidos na transição manual (cozinha/atendente)
const STATUS_TRANSICAO_MANUAL = ['EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'];

// ---------------------------------------------------------------
// Criação de pedido
// ---------------------------------------------------------------
const criarPedidoSchema = z
  .object({
    unidadeId: z
      .number({ required_error: 'unidadeId é obrigatório.', invalid_type_error: 'unidadeId deve ser um número.' })
      .int()
      .positive('unidadeId deve ser um inteiro positivo.'),

    clienteId: z
      .number({ invalid_type_error: 'clienteId deve ser um número.' })
      .int()
      .positive()
      .nullable()
      .optional(),

    canalPedido: z
      .enum(CANAIS_VALIDOS, {
        required_error: 'canalPedido é obrigatório.',
        invalid_type_error: `canalPedido deve ser um dos valores: ${CANAIS_VALIDOS.join(', ')}.`,
        message: `canalPedido inválido. Valores aceitos: ${CANAIS_VALIDOS.join(', ')}.`,
      }),

    formaPagamento: z
      .enum(FORMAS_PAGAMENTO_VALIDAS, {
        required_error: 'formaPagamento é obrigatória.',
        message: `formaPagamento inválida. Valores aceitos: ${FORMAS_PAGAMENTO_VALIDAS.join(', ')}.`,
      }),

    itens: z
      .array(
        z.object({
          itemId: z
            .number({ required_error: 'itemId é obrigatório em cada item.', invalid_type_error: 'itemId deve ser um número.' })
            .int()
            .positive(),
          variacaoId: z
            .number({ required_error: 'variacaoId é obrigatório em cada item.', invalid_type_error: 'variacaoId deve ser um número.' })
            .int()
            .positive(),
          quantidade: z
            .number({ required_error: 'quantidade é obrigatória em cada item.', invalid_type_error: 'quantidade deve ser um número.' })
            .int()
            .min(1, 'quantidade deve ser pelo menos 1.'),
        })
      )
      .min(1, 'O pedido deve conter ao menos um item.'),

    voucherCodigo: z.string().optional(),
    anonimo: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    // Dinheiro só é aceito em canais presenciais
    if (
      FORMAS_SOMENTE_PRESENCIAL.includes(data.formaPagamento) &&
      !CANAIS_PRESENCIAIS.includes(data.canalPedido)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['formaPagamento'],
        message: `Pagamento em DINHEIRO só é aceito nos canais: ${CANAIS_PRESENCIAIS.join(', ')}.`,
      });
    }
  });

// ---------------------------------------------------------------
// Atualização de status do pedido
// ---------------------------------------------------------------
const atualizarStatusSchema = z.object({
  status: z.enum(STATUS_TRANSICAO_MANUAL, {
    required_error: 'status é obrigatório.',
    message: `status inválido. Valores aceitos: ${STATUS_TRANSICAO_MANUAL.join(', ')}.`,
  }),
  motivo: z.string().optional(),
});

// ---------------------------------------------------------------
// Helper de formatação de erros Zod → padrão do projeto
// ---------------------------------------------------------------
function formatarErrosZod(zodError) {
  return zodError.errors.map((e) => ({
    field: e.path.join('.') || 'body',
    issue: e.message,
  }));
}

module.exports = {
  criarPedidoSchema,
  atualizarStatusSchema,
  formatarErrosZod,
  CANAIS_PRESENCIAIS,
};
