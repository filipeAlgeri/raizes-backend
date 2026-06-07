const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // -------------------------------------------------------
  // Usuário central (ADMIN)
  // -------------------------------------------------------
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.usuarioCentral.upsert({
    where: { email: 'admin@raizesdnordeste.com' },
    update: {},
    create: {
      nome: 'Administrador Central',
      email: 'admin@raizesdnordeste.com',
      senhaHash: adminHash,
      perfil: 'ADMIN',
      setor: 'TI',
    },
  });
  console.log(`Admin central criado: ${admin.email}`);

  // -------------------------------------------------------
  // Unidade (matriz)
  // -------------------------------------------------------
  const unidade = await prisma.unidade.upsert({
    where: { cnpj: '12345678000100' },
    update: {},
    create: {
      nome: 'Raízes do Nordeste — Matriz Recife',
      cnpj: '12345678000100',
      cidade: 'Recife',
      estado: 'PE',
      endereco: 'Av. Boa Viagem, 1000',
      telefone: '8132220000',
    },
  });
  console.log(`Unidade criada: ${unidade.nome}`);

  // -------------------------------------------------------
  // Gerente da unidade
  // -------------------------------------------------------
  const gerenteHash = await bcrypt.hash('Gerente@123', 10);
  const gerente = await prisma.colaborador.upsert({
    where: { email: 'gerente@raizesdnordeste.com' },
    update: {},
    create: {
      unidadeId: unidade.id,
      nome: 'Carlos Gerente',
      cpf: '98765432100',
      email: 'gerente@raizesdnordeste.com',
      senhaHash: gerenteHash,
      perfil: 'GERENTE',
    },
  });
  console.log(`Gerente criado: ${gerente.email}`);

  // -------------------------------------------------------
  // Atendente da unidade
  // -------------------------------------------------------
  const atendenteHash = await bcrypt.hash('Atendente@123', 10);
  await prisma.colaborador.upsert({
    where: { email: 'atendente@raizesdnordeste.com' },
    update: {},
    create: {
      unidadeId: unidade.id,
      nome: 'Ana Atendente',
      cpf: '11122233344',
      email: 'atendente@raizesdnordeste.com',
      senhaHash: atendenteHash,
      perfil: 'ATENDENTE',
    },
  });

  // Colaborador cozinha
  const cozinhaHash = await bcrypt.hash('Cozinha@123', 10);
  await prisma.colaborador.upsert({
    where: { email: 'cozinha@raizesdnordeste.com' },
    update: {},
    create: {
      unidadeId: unidade.id,
      nome: 'João Cozinha',
      cpf: '55566677788',
      email: 'cozinha@raizesdnordeste.com',
      senhaHash: cozinhaHash,
      perfil: 'COZINHA',
    },
  });
  console.log('Colaboradores criados.');

  // -------------------------------------------------------
  // Itens do cardápio
  // -------------------------------------------------------
  const bauru = await prisma.itemCardapio.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nome: 'Bauru Nordestino',
      descricao: 'Pão de forma, carne de sol desfiada, queijo coalho e manteiga de garrafa.',
      categoria: 'LANCHE',
      status: 'APROVADO',
      variacoes: {
        create: [
          { tamanho: 'P', preco: 18.90 },
          { tamanho: 'M', preco: 24.90 },
          { tamanho: 'G', preco: 29.90 },
        ],
      },
    },
  });

  const tapioca = await prisma.itemCardapio.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nome: 'Tapioca Recheada',
      descricao: 'Tapioca com recheio à escolha: frango, carne de sol ou queijo coalho.',
      categoria: 'LANCHE',
      status: 'APROVADO',
      variacoes: {
        create: [
          { tamanho: 'P', preco: 10.00 },
          { tamanho: 'M', preco: 14.90 },
        ],
      },
    },
  });

  const suco = await prisma.itemCardapio.upsert({
    where: { id: 3 },
    update: {},
    create: {
      nome: 'Suco Natural',
      descricao: 'Suco de frutas: cajá, acerola, maracujá, graviola, laranja, caju ou cupuaçu.',
      categoria: 'BEBIDA',
      status: 'APROVADO',
      variacoes: {
        create: [
          { tamanho: 'P', preco: 5.00 },
          { tamanho: 'M', preco: 8.00 },
          { tamanho: 'G', preco: 12.00 },
        ],
      },
    },
  });
  console.log('Itens do cardápio criados.');

  // -------------------------------------------------------
  // Cardápio da unidade
  // -------------------------------------------------------
  for (const item of [bauru, tapioca, suco]) {
    await prisma.cardapioUnidade.upsert({
      where: { unidadeId_itemId: { unidadeId: unidade.id, itemId: item.id } },
      update: {},
      create: { unidadeId: unidade.id, itemId: item.id, disponivel: true },
    });
  }
  console.log('Cardápio da unidade configurado.');

  // -------------------------------------------------------
  // Estoque inicial
  // -------------------------------------------------------
  for (const item of [bauru, tapioca, suco]) {
    await prisma.estoque.upsert({
      where: { unidadeId_itemId: { unidadeId: unidade.id, itemId: item.id } },
      update: {},
      create: { unidadeId: unidade.id, itemId: item.id, quantidade: 50 },
    });
  }
  console.log('Estoque inicial criado.');

  // -------------------------------------------------------
  // Cliente de teste
  // -------------------------------------------------------
  const clienteHash = await bcrypt.hash('Cliente@123', 10);
  const cliente = await prisma.cliente.upsert({
    where: { email: 'cliente@teste.com' },
    update: {
      telefone: '81988880000',
      cpf: '22233344455',
      senhaHash: clienteHash,
      aceiteLgpd: true,
      aceiteFidelidade: true,
    },
    create: {
      nome: 'Maria Teste',
      email: 'cliente@teste.com',
      telefone: '81988880000',
      cpf: '22233344455',
      senhaHash: clienteHash,
      aceiteLgpd: true,
      aceiteFidelidade: true,
      pontosCliente: {
        create: { saldoAtual: 0, totalPedidos: 0 },
      },
    },
  });
  console.log(`Cliente de teste criado: ${cliente.email}`);

  console.log('\nSeed concluído com sucesso!');
  console.log('-----------------------------------');
  console.log('Credenciais para testes:');
  console.log('  Admin central : admin@raizesdnordeste.com / Admin@123 (tipo: central)');
  console.log('  Gerente       : gerente@raizesdnordeste.com / Gerente@123 (tipo: colaborador)');
  console.log('  Atendente     : atendente@raizesdnordeste.com / Atendente@123 (tipo: colaborador)');
  console.log('  Cozinha       : cozinha@raizesdnordeste.com / Cozinha@123 (tipo: colaborador)');
  console.log('  Cliente       : cliente@teste.com / Cliente@123 (tipo: cliente)');
  console.log('-----------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
