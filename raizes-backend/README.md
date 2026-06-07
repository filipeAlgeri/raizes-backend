# Raízes do Nordeste — API Back-End

API REST da rede de lanchonetes **Raízes do Nordeste**.  
Projeto Multidisciplinar — Trilha Back-End — UNINTER 2026.

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Requisitos de ambiente](#2-requisitos-de-ambiente)
3. [Instalação](#3-instalação)
4. [Variáveis de ambiente](#4-variáveis-de-ambiente)
5. [Banco de dados — migrations e seed](#5-banco-de-dados--migrations-e-seed)
6. [Iniciando a API](#6-iniciando-a-api)
7. [Documentação Swagger](#7-documentação-swagger)
8. [Coleção Postman — executando os testes](#8-coleção-postman--executando-os-testes)
9. [Credenciais de teste (seed)](#9-credenciais-de-teste-seed)
10. [Endpoints disponíveis](#10-endpoints-disponíveis)
11. [Estrutura de pastas](#11-estrutura-de-pastas)
12. [Decisões técnicas relevantes](#12-decisões-técnicas-relevantes)
13. [Uso de IA](#13-uso-de-ia)

---

## 1. Visão geral

A API atende a rede de lanchonetes **Raízes do Nordeste**, suportando múltiplos
canais de pedido (APP, WEB, TOTEM, BALCÃO, PICKUP) com autenticação JWT,
controle de estoque por unidade, programa de fidelidade e integração simulada
com gateway de pagamento (mock).

**Tecnologias:**

| Camada | Tecnologia |
|---|---|
| Linguagem | Node.js 18+ |
| Framework | Express 4 |
| ORM / Migrations | Prisma 5 |
| Banco de dados | PostgreSQL 14+ |
| Autenticação | JWT (jsonwebtoken) |
| Validação | Zod |
| Documentação | Swagger UI / OpenAPI 3 (swagger-jsdoc) |
| Hash de senha | bcrypt |

---

## 2. Requisitos de ambiente

- **Node.js** v18 ou superior — [nodejs.org](https://nodejs.org)
- **npm** v9 ou superior (incluso no Node.js)
- **PostgreSQL** 14 ou superior — [postgresql.org](https://www.postgresql.org)
- Git (para clonar o repositório)

Verifique as versões instaladas:

```bash
node -v   # deve ser >= 18.0.0
npm -v    # deve ser >= 9.0.0
psql --version
```

---

## 3. Instalação

### 3.1 Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/raizes-backend.git
cd raizes-backend
```

> Substitua `SEU_USUARIO` pelo seu usuário no GitHub.

### 3.2 Instale as dependências

```bash
npm install
```

Isso instala todas as dependências listadas em `package.json`, incluindo
Prisma CLI, Express, JWT, Zod e Swagger.

---

## 4. Variáveis de ambiente

Copie o arquivo de exemplo e edite com seus dados:

```bash
cp .env.example .env
```

Abra o `.env` e preencha **todas** as variáveis:

```env
# -------------------------------------------------------
# Banco de dados PostgreSQL
# Formato: postgresql://USUARIO:SENHA@HOST:PORTA/BANCO
# -------------------------------------------------------
DATABASE_URL="postgresql://postgres:suasenha@localhost:5432/raizes_db"

# -------------------------------------------------------
# Servidor
# -------------------------------------------------------
PORT=3000
NODE_ENV=development

# -------------------------------------------------------
# JWT
# Use uma string longa e aleatória para JWT_SECRET.
# Sugestão: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# -------------------------------------------------------
JWT_SECRET="troque_por_uma_chave_segura_e_longa_de_ao_menos_64_caracteres"
JWT_EXPIRES_IN="1h"

# -------------------------------------------------------
# Modo do gateway de pagamento simulado
# "always_approve" → todos os pagamentos aprovados (recomendado para testes)
# "always_reject"  → todos os pagamentos recusados
# "random"         → 80% aprovação / 20% recusa
# -------------------------------------------------------
PAYMENT_MOCK_MODE="always_approve"
```

> **Importante:** nunca suba o arquivo `.env` para o repositório.
> O `.gitignore` já o exclui por padrão.

---

## 5. Banco de dados — migrations e seed

### 5.1 Crie o banco no PostgreSQL

Conecte ao PostgreSQL e execute:

```sql
CREATE DATABASE raizes_db;
```

Ou pela linha de comando:

```bash
psql -U postgres -c "CREATE DATABASE raizes_db;"
```

### 5.2 Execute as migrations

```bash
npm run migrate
```

O Prisma criará todas as tabelas definidas em `prisma/schema.prisma`.
Quando solicitado um nome para a migration, use: `init`.

> Em ambiente de produção/CI use `npm run migrate:prod`
> (`prisma migrate deploy`) em vez de `migrate dev`.

### 5.3 Gere o Prisma Client

Após a migration, gere o client (necessário na primeira vez e após alterações no schema):

```bash
npm run generate
```

### 5.4 Execute o seed (dados iniciais)

```bash
npm run seed
```

O seed cria:

| Recurso | Dados criados |
|---|---|
| Unidade | Raízes do Nordeste — Matriz Recife (id = 1) |
| Usuário central | admin@raizesdnordeste.com (ADMIN) |
| Colaboradores | gerente, atendente, cozinha (unidade 1) |
| Itens do cardápio | Bauru Nordestino, Tapioca Recheada, Suco Natural |
| Estoque inicial | 50 unidades de cada item na unidade 1 |
| Cliente de teste | cliente@teste.com (aceiteFidelidade = true) |

---

## 6. Iniciando a API

### Modo desenvolvimento (hot reload via nodemon)

```bash
npm run dev
```

### Modo produção

```bash
npm start
```

A API estará disponível em:

```
http://localhost:3000
```

Você verá no terminal:

```
Servidor rodando em http://localhost:3000
Swagger disponível em http://localhost:3000/api-docs
Ambiente: development
```

---

## 7. Documentação Swagger

Com a API rodando, acesse:

```
http://localhost:3000/api-docs
```

O Swagger UI exibe todos os endpoints com exemplos de request/response,
códigos de status e o padrão de erro JSON. É possível executar chamadas
diretamente pela interface clicando em **Authorize** e inserindo o token
JWT no formato `Bearer <token>`.

---

## 8. Coleção Postman — executando os testes

### 8.1 Importar a coleção

1. Abra o Postman.
2. Clique em **Import**.
3. Selecione o arquivo `raizes-backend.postman_collection.json`
   (localizado na raiz do projeto).

### 8.2 Configurar o environment

Crie um novo environment no Postman com a variável:

| Variável | Valor inicial |
|---|---|
| `baseUrl` | `http://localhost:3000` |

As variáveis `tokenCliente`, `tokenGerente`, `tokenCozinha` e `pedidoId`
são preenchidas **automaticamente** pelos scripts de teste das requisições
T01, T02, T03 e T04.

### 8.3 Pré-condições

Antes de rodar a coleção:

1. API rodando localmente (`npm run dev`)
2. Seed executado (`npm run seed`)
3. `PAYMENT_MOCK_MODE=always_approve` no `.env`
   (garante que o pedido T04 seja aprovado e as transições T07/T08 sejam testáveis)

### 8.4 Ordem de execução recomendada

Execute as requisições na seguinte ordem dentro do Postman:

```
Pasta AUTH
  1. T01 — Login cliente
  2. T02 — Login gerente
  3. T03 — Login cozinha
  4. T13 — Acesso sem token          (negativo)
  5. T14 — Credenciais inválidas     (negativo)

Pasta PEDIDOS
  6.  T04 — Criar pedido via TOTEM
  7.  T05 — Listar pedidos por canal
  8.  T06 — Buscar pedido por ID
  9.  T07 — Atualizar status → PRONTO
  10. T08 — Atualizar status → ENTREGUE
  11. T15 — canalPedido ausente       (negativo)
  12. T16 — Logs de auditoria

Pasta ESTOQUE
  13. T09 — Consultar saldo da unidade
  14. T10 — Registrar entrada
  15. T17 — Saída insuficiente         (negativo)

Pasta FIDELIDADE
  16. T11 — Consultar saldo de pontos
  17. T12 — Resgatar sem saldo         (negativo)

Pasta ERROS — Autorização
  18. T18 — CLIENTE tenta entrada de estoque  (negativo — 403)
  19. T19 — Unidade inexistente               (negativo — 404)
  20. T20 — Transição de status inválida      (negativo — 409)
```

> **Dica:** use o runner do Postman (**Collection Runner**) para
> executar todos os testes em sequência e ver o relatório consolidado.

---

## 9. Credenciais de teste (seed)

| Usuário | E-mail | Senha | Tipo (campo `tipo` no login) |
|---|---|---|---|
| Administrador central | admin@raizesdnordeste.com | Admin@123 | `central` |
| Gerente | gerente@raizesdnordeste.com | Gerente@123 | `colaborador` |
| Atendente | atendente@raizesdnordeste.com | Atendente@123 | `colaborador` |
| Cozinha | cozinha@raizesdnordeste.com | Cozinha@123 | `colaborador` |
| Cliente | cliente@teste.com | Cliente@123 | `cliente` |

**IDs criados pelo seed (usados na coleção Postman):**

| Recurso | ID |
|---|---|
| Unidade — Matriz Recife | 1 |
| Cliente de teste | 1 |
| Bauru Nordestino | 1 (variações: P=1, M=2, G=3) |
| Tapioca Recheada | 2 (variações: P=4, M=5) |
| Suco Natural | 3 (variações: P=6, M=7, G=8) |

---

## 10. Endpoints disponíveis

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| POST | `/auth/login` | Autenticação — retorna JWT | público |
| POST | `/auth/cadastro` | Cadastro de cliente | público |
| POST | `/auth/logout` | Encerrar sessão | autenticado |
| GET | `/unidades` | Listar unidades | ADMIN, GERENTE |
| GET | `/unidades/:id` | Buscar unidade | ADMIN, GERENTE |
| POST | `/unidades` | Criar unidade | ADMIN |
| PATCH | `/unidades/:id` | Atualizar unidade | ADMIN |
| GET | `/produtos` | Listar itens do cardápio | todos |
| GET | `/produtos/:id` | Buscar item | todos |
| POST | `/produtos` | Criar item (central) | ADMIN, MARKETING |
| PATCH | `/produtos/:id` | Atualizar item | ADMIN, MARKETING |
| GET | `/unidades/:id/estoque` | Saldo de estoque da unidade | ADMIN, GERENTE, SUPORTE |
| GET | `/unidades/:id/estoque/movimentacoes` | Histórico de movimentações | ADMIN, GERENTE, SUPORTE |
| GET | `/unidades/:id/estoque/:itemId` | Saldo de item específico | ADMIN, GERENTE, SUPORTE |
| POST | `/unidades/:id/estoque/:itemId/entrada` | Registrar entrada | ADMIN, GERENTE |
| POST | `/unidades/:id/estoque/:itemId/saida` | Registrar saída manual | ADMIN, GERENTE |
| PATCH | `/unidades/:id/estoque/:itemId/ajuste` | Ajuste de inventário | ADMIN, GERENTE |
| POST | `/pedidos` | Criar pedido | CLIENTE, ATENDENTE, GERENTE |
| GET | `/pedidos` | Listar pedidos (com filtros) | colaboradores + CLIENTE |
| GET | `/pedidos/:id` | Buscar pedido | colaboradores + CLIENTE |
| PATCH | `/pedidos/:id/status` | Atualizar status | COZINHA, GERENTE, ADMIN |
| DELETE | `/pedidos/:id/cancelar` | Cancelar pedido | CLIENTE (próprio), GERENTE |
| GET | `/pedidos/:id/logs` | Logs de auditoria do pedido | GERENTE, ADMIN |
| GET | `/fidelidade/:clienteId/saldo` | Saldo de pontos | CLIENTE (próprio), GERENTE |
| GET | `/fidelidade/:clienteId/historico` | Histórico de pontos | CLIENTE (próprio), GERENTE |
| POST | `/fidelidade/:clienteId/resgatar` | Resgatar pontos | CLIENTE (próprio), ADMIN |

---

## 11. Estrutura de pastas

```
raizes-backend/
├── prisma/
│   ├── schema.prisma          ← 19 models, 14 enums — DER técnico completo
│   └── seed.js                ← Dados iniciais reproduzíveis
│
├── src/
│   ├── domain/
│   │   └── errors/
│   │       └── index.js       ← Erros de domínio customizados (AppError e subclasses)
│   │
│   ├── application/           ← Casos de uso — toda a lógica de negócio fica aqui
│   │   ├── auth/
│   │   │   ├── cadastrarUsuario.js
│   │   │   ├── loginUsuario.js
│   │   │   └── auth.validation.js
│   │   ├── cardapio/
│   │   │   ├── unidadeService.js
│   │   │   ├── produtoService.js
│   │   │   └── cardapio.validation.js
│   │   ├── estoque/
│   │   │   └── estoqueService.js  ← inclui utilitários para Pedidos
│   │   ├── pedido/
│   │   │   ├── pedidoService.js
│   │   │   └── pedido.validation.js
│   │   └── fidelidade/
│   │       └── fidelidadeService.js
│   │
│   ├── infrastructure/
│   │   ├── prisma/
│   │   │   └── client.js      ← Instância compartilhada do PrismaClient
│   │   └── mock/
│   │       └── pagamentoMockService.js  ← Simulação de gateway de pagamento
│   │
│   └── api/
│       ├── controllers/       ← Handlers finos — apenas input/output, sem lógica
│       │   ├── AuthController.js
│       │   ├── UnidadeController.js
│       │   ├── ProdutoController.js
│       │   ├── EstoqueController.js
│       │   ├── PedidoController.js
│       │   └── FidelidadeController.js
│       ├── middlewares/
│       │   ├── auth.middleware.js  ← JWT + autorizar(...perfis)
│       │   ├── errorHandler.js    ← Converte AppError → JSON padronizado
│       │   └── logger.js
│       ├── routes/            ← Definição de rotas + Swagger JSDoc
│       │   ├── auth.routes.js
│       │   ├── unidades.routes.js
│       │   ├── produtos.routes.js
│       │   ├── estoque.routes.js
│       │   ├── pedidos.routes.js
│       │   └── fidelidade.routes.js
│       └── swagger/
│           └── swagger.config.js
│
├── raizes-backend.postman_collection.json  ← 20 cenários de teste
├── .env.example
├── package.json
└── README.md
```

---

## 12. Decisões técnicas relevantes

**Arquitetura em camadas (Domain → Application → Infrastructure → API)**
Separação explícita de responsabilidades: a camada `application` nunca
importa do `api`, e a `api` nunca acessa o Prisma diretamente.

**Transações atômicas nos fluxos críticos**
Criação de pedido, decremento de estoque, registro de pagamento e
atualização de status são executados em `prisma.$transaction` único,
garantindo consistência mesmo em caso de falha parcial.

**Reversão de estoque automática**
Se o pagamento mock for recusado, o estoque é revertido na mesma
transação que registra o cancelamento — sem janela de inconsistência.

**Idempotência em pedidos**
Um segundo pedido do mesmo cliente na mesma unidade e canal dentro de
30 segundos retorna o pedido já existente, evitando duplicatas.

**canalPedido como dado de domínio obrigatório**
O campo é required no schema, validado por Zod e incluído em todas as
consultas de listagem via query param `?canalPedido=TOTEM`.

**Rastreabilidade de auditoria**
Toda transição de status do pedido é registrada em `LogPedido` com
`statusAntes`, `statusDepois`, `realizadoPor` e timestamp.
Toda movimentação de estoque é registrada em `MovimentacaoEstoque`
com quantidade anterior, resultante, tipo e responsável.

**Pagamento mock configurável via .env**
`PAYMENT_MOCK_MODE=always_approve` para testes determinísticos;
`random` para simular cenários reais com falha.

---

## 13. Uso de IA

Este projeto foi desenvolvido com apoio de **Claude (Anthropic)** para:
planejamento da arquitetura, modelagem do schema Prisma, implementação
dos módulos de estoque, pedido e fidelidade, e elaboração da documentação.

Todo o código foi revisado, contextualizado e validado pelo desenvolvedor
antes da entrega, conforme orientação do roteiro.

Ferramenta: Claude Sonnet (claude.ai)
