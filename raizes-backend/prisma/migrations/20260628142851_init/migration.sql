-- CreateEnum
CREATE TYPE "PerfilCentral" AS ENUM ('ADMIN', 'FINANCEIRO', 'MARKETING', 'RH_CENTRAL', 'SUPORTE');

-- CreateEnum
CREATE TYPE "PerfilColaborador" AS ENUM ('GERENTE', 'ATENDENTE', 'COZINHA', 'LIMPEZA');

-- CreateEnum
CREATE TYPE "CanalPedido" AS ENUM ('APP', 'WEB', 'TOTEM', 'BALCAO', 'PICKUP');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'VOUCHER', 'DINHEIRO', 'MOCK');

-- CreateEnum
CREATE TYPE "StatusItem" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "EscopoVoucher" AS ENUM ('REDE', 'UNIDADES_SELECIONADAS', 'UNIDADE_PROPRIA');

-- CreateEnum
CREATE TYPE "TipoPonto" AS ENUM ('GANHO', 'BONUS_PEDIDOS', 'RESGATE', 'ESTORNO');

-- CreateEnum
CREATE TYPE "StatusSugestao" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('PEDIDO_CONFIRMADO', 'PAGAMENTO_APROVADO', 'PAGAMENTO_RECUSADO', 'PEDIDO_EM_PREPARO', 'PEDIDO_PRONTO', 'PEDIDO_ENTREGUE', 'PEDIDO_CANCELADO', 'PONTOS_CREDITADOS');

-- CreateEnum
CREATE TYPE "StatusEnvio" AS ENUM ('PENDENTE', 'ENVIADO', 'FALHOU');

-- CreateEnum
CREATE TYPE "CategoriaItem" AS ENUM ('LANCHE', 'BEBIDA', 'SOBREMESA', 'ACOMPANHAMENTO', 'COMBO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- CreateTable
CREATE TABLE "usuarios_central" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "PerfilCentral" NOT NULL,
    "setor" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_central_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "telefone" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" SERIAL NOT NULL,
    "unidade_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "PerfilColaborador" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "cpf" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "aceite_lgpd" BOOLEAN NOT NULL DEFAULT false,
    "aceite_fidelidade" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_cardapio" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" "CategoriaItem" NOT NULL,
    "status" "StatusItem" NOT NULL DEFAULT 'PENDENTE',
    "criado_por_unidade_id" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_cardapio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variacoes_item" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "tamanho" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "variacoes_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardapio_unidade" (
    "id" SERIAL NOT NULL,
    "unidade_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cardapio_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque" (
    "id" SERIAL NOT NULL,
    "unidade_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" SERIAL NOT NULL,
    "estoque_id" INTEGER NOT NULL,
    "unidade_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "quantidade_anterior" INTEGER NOT NULL,
    "quantidade_resultante" INTEGER NOT NULL,
    "motivo" TEXT,
    "realizado_por" TEXT,
    "pedido_id" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "unidade_id" INTEGER NOT NULL,
    "cliente_id" INTEGER,
    "canal_pedido" "CanalPedido" NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "total" DECIMAL(10,2) NOT NULL,
    "forma_pagamento" "FormaPagamento" NOT NULL,
    "anonimo" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "variacao_id" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "resposta_mock" JSONB,
    "transacao_id" TEXT,
    "processado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos_cliente" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "saldo_atual" INTEGER NOT NULL DEFAULT 0,
    "total_pedidos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pontos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_pontos" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "pedido_id" INTEGER,
    "pontos_cliente_id" INTEGER,
    "tipo" "TipoPonto" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_pontos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" SERIAL NOT NULL,
    "emitido_por_unidade_id" INTEGER,
    "cliente_id" INTEGER,
    "codigo" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "escopo" "EscopoVoucher" NOT NULL,
    "validade" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_unidade" (
    "id" SERIAL NOT NULL,
    "voucher_id" INTEGER NOT NULL,
    "unidade_id" INTEGER NOT NULL,

    CONSTRAINT "voucher_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas" (
    "id" SERIAL NOT NULL,
    "unidade_id" INTEGER,
    "descricao" TEXT NOT NULL,
    "desconto_percentual" DECIMAL(5,2) NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sugestoes_item" (
    "id" SERIAL NOT NULL,
    "unidade_id" INTEGER NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "item_original_id" INTEGER,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusSugestao" NOT NULL DEFAULT 'PENDENTE',
    "resposta_admin" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sugestoes_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "pedido_id" INTEGER,
    "tipo" "TipoNotificacao" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status_envio" "StatusEnvio" NOT NULL DEFAULT 'PENDENTE',
    "enviada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_pedido" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "status_antes" "StatusPedido",
    "status_depois" "StatusPedido" NOT NULL,
    "realizado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_central_email_key" ON "usuarios_central"("email");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_cnpj_key" ON "unidades"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_cpf_key" ON "colaboradores"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_email_key" ON "colaboradores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpf_key" ON "clientes"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "variacoes_item_item_id_tamanho_key" ON "variacoes_item"("item_id", "tamanho");

-- CreateIndex
CREATE UNIQUE INDEX "cardapio_unidade_unidade_id_item_id_key" ON "cardapio_unidade"("unidade_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_unidade_id_item_id_key" ON "estoque"("unidade_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_pedido_id_key" ON "pagamentos"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "pontos_cliente_cliente_id_key" ON "pontos_cliente"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_codigo_key" ON "vouchers"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_unidade_voucher_id_unidade_id_key" ON "voucher_unidade"("voucher_id", "unidade_id");

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variacoes_item" ADD CONSTRAINT "variacoes_item_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itens_cardapio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardapio_unidade" ADD CONSTRAINT "cardapio_unidade_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardapio_unidade" ADD CONSTRAINT "cardapio_unidade_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itens_cardapio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque" ADD CONSTRAINT "estoque_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque" ADD CONSTRAINT "estoque_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itens_cardapio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_estoque_id_fkey" FOREIGN KEY ("estoque_id") REFERENCES "estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itens_cardapio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_variacao_id_fkey" FOREIGN KEY ("variacao_id") REFERENCES "variacoes_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_cliente" ADD CONSTRAINT "pontos_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_pontos" ADD CONSTRAINT "historico_pontos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_pontos" ADD CONSTRAINT "historico_pontos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_pontos" ADD CONSTRAINT "historico_pontos_pontos_cliente_id_fkey" FOREIGN KEY ("pontos_cliente_id") REFERENCES "pontos_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_emitido_por_unidade_id_fkey" FOREIGN KEY ("emitido_por_unidade_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_unidade" ADD CONSTRAINT "voucher_unidade_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_unidade" ADD CONSTRAINT "voucher_unidade_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugestoes_item" ADD CONSTRAINT "sugestoes_item_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugestoes_item" ADD CONSTRAINT "sugestoes_item_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugestoes_item" ADD CONSTRAINT "sugestoes_item_item_original_id_fkey" FOREIGN KEY ("item_original_id") REFERENCES "itens_cardapio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_pedido" ADD CONSTRAINT "logs_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
