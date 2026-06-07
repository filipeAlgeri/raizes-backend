const { z } = require('zod');

const cadastroSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres.'),
  email: z.string().email('E-mail inválido.'),
  telefone: z.string().optional(),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos numéricos sem pontuação.'),
  senha: z
    .string()
    .min(8, 'Senha deve ter ao menos 8 caracteres.')
    .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula.')
    .regex(/[0-9]/, 'Senha deve conter ao menos um número.'),
  aceiteLgpd: z.boolean(),
  aceiteFidelidade: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(1, 'Senha obrigatória.'),
  tipo: z.enum(['cliente', 'colaborador', 'central']).optional().default('cliente'),
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

module.exports = { cadastroSchema, loginSchema, validar };
