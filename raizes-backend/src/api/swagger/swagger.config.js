const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Raízes do Nordeste — API',
      version: '1.0.0',
      description: 'API REST da rede de lanchonetes Raízes do Nordeste. Projeto Multidisciplinar — Trilha Back-End — UNINTER 2026.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Erropadrao: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'NOME_DO_ERRO' },
            message: { type: 'string', example: 'Mensagem legível para o usuário.' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  issue: { type: 'string' },
                },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
            path: { type: 'string' },
          },
        },
      },
      responses: {
        NaoAutenticado: {
          description: 'Token ausente ou inválido',
          content: {
            'application/json': {
              example: {
                error: 'NAO_AUTENTICADO',
                message: 'Token de autenticação não informado.',
                details: [],
                timestamp: '2026-05-21T12:00:00Z',
                path: '/recurso',
              },
            },
          },
        },
        SemPermissao: {
          description: 'Perfil sem permissão para o recurso',
          content: {
            'application/json': {
              example: {
                error: 'SEM_PERMISSAO',
                message: 'Seu perfil não tem permissão para acessar este recurso.',
                details: [],
                timestamp: '2026-05-21T12:00:00Z',
                path: '/recurso',
              },
            },
          },
        },
        NaoEncontrado: {
          description: 'Recurso não encontrado',
          content: {
            'application/json': {
              example: {
                error: 'RECURSO_NAO_ENCONTRADO',
                message: 'Recurso não encontrado.',
                details: [],
                timestamp: '2026-05-21T12:00:00Z',
                path: '/recurso/99',
              },
            },
          },
        },
        ErroValidacao: {
          description: 'Erro de validação nos dados enviados',
          content: {
            'application/json': {
              example: {
                error: 'QUANTIDADE_INVALIDA',
                message: 'A quantidade deve ser um número inteiro positivo.',
                details: [{ field: 'quantidade', issue: 'Deve ser maior que zero.' }],
                timestamp: '2026-05-21T12:00:00Z',
                path: '/recurso',
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/api/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
