const { z } = require('zod');

const unidadeSchema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos.'),
  cidade: z.string().min(2),
  estado: z.string().length(2, 'Estado deve ser a sigla com 2 letras.'),
  endereco: z.string().min(5),
  telefone: z.string().optional(),
});

const variacaoSchema = z.object({
  tamanho: z.string().min(1),
  preco: z.number().positive('Preço deve ser positivo.'),
});

const produtoSchema = z.object({
  nome: z.string().min(2),
  descricao: z.string().optional(),
  categoria: z.enum([
    'LANCHE', 'BEBIDA', 'SOBREMESA', 'ACOMPANHAMENTO', 'COMBO', 'OUTRO',
  ]),
  variacoes: z.array(variacaoSchema).min(1, 'Informe ao menos uma variação de tamanho.'),
});

const sugestaoSchema = z.object({
  nome: z.string().min(2),
  descricao: z.string().optional(),
});

const cardapioUnidadeSchema = z.object({
  itemId: z.number().int().positive(),
  disponivel: z.boolean(),
});

function validar(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) {
      const detalhes = resultado.error.errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message,
      }));
      return res.status(422).json({
        error: 'VALIDACAO_INVALIDA',
        message: 'Um ou mais campos são inválidos.',
        details: detalhes,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }
    req.body = resultado.data;
    next();
  };
}

module.exports = {
  unidadeSchema,
  produtoSchema,
  sugestaoSchema,
  cardapioUnidadeSchema,
  validar,
};
