/**
 * Testes unitários — Cálculos do Programa de Fidelidade
 *
 * Testa as quatro funções puras de fidelidade.calculos.js diretamente,
 * sem banco de dados, sem HTTP, sem mocks.
 *
 * Regras de negócio cobertas:
 *  - R$1,00 gasto = 1 ponto (Math.floor — frações descartadas)
 *  - 100 pontos = R$20,00 de desconto
 *  - +15 pontos de bônus a cada 5 pedidos ENTREGUE
 *  - Resgate parcial: usa todos os pontos quando o desconto não cobre a compra
 *  - Resgate total:   usa apenas os pontos necessários para cobrir a compra
 *
 * Por que testar unitariamente?
 *  Os testes de integração (3-fidelidade.test.js) verificam o resultado via HTTP
 *  com um cenário fixo (119 pontos). Aqui cobrimos casos de borda — valores fracionários,
 *  múltiplos de 5, resgate exato — que seriam caros de exercitar via API completa.
 */
const {
  calcularPontosGanhos,
  calcularEquivalenteEmReais,
  calcularProximoBonus,
  calcularResgate,
  PONTOS_PARA_RESGATAR,
  VALOR_RESGATE,
  BONUS_A_CADA_PEDIDOS,
  BONUS_QUANTIDADE,
} = require('../../application/fidelidade/fidelidade.calculos');

// =============================================================
// calcularPontosGanhos — R$1,00 = 1 ponto (Math.floor)
// =============================================================
describe('calcularPontosGanhos', () => {
  it('R$100,00 → 100 pontos', () => {
    expect(calcularPontosGanhos(100)).toBe(100);
  });

  it('R$119,60 → 119 pontos (fração descartada)', () => {
    // Cenário do 3-fidelidade.test.js: 4 × R$29,90 = R$119,60
    expect(calcularPontosGanhos(119.60)).toBe(119);
  });

  it('R$18,90 → 18 pontos (fração descartada)', () => {
    // 1× Bauru P (seed)
    expect(calcularPontosGanhos(18.90)).toBe(18);
  });

  it('R$29,90 → 29 pontos (fração descartada)', () => {
    // 1× Bauru G (seed)
    expect(calcularPontosGanhos(29.90)).toBe(29);
  });

  it('R$0,99 → 0 pontos (abaixo de R$1,00)', () => {
    expect(calcularPontosGanhos(0.99)).toBe(0);
  });

  it('R$0,00 → 0 pontos', () => {
    expect(calcularPontosGanhos(0)).toBe(0);
  });

  it('aceita string numérica (conversão robusta)', () => {
    expect(calcularPontosGanhos('50.75')).toBe(50);
  });
});

// =============================================================
// calcularEquivalenteEmReais — 100 pts = R$20,00
// =============================================================
describe('calcularEquivalenteEmReais', () => {
  it('100 pontos → R$20,00 (exato)', () => {
    expect(calcularEquivalenteEmReais(100)).toBe(20);
  });

  it('119 pontos → R$23,80', () => {
    // 119 × 20 / 100 = 23,80
    expect(calcularEquivalenteEmReais(119)).toBeCloseTo(23.80, 2);
  });

  it('50 pontos → R$10,00', () => {
    expect(calcularEquivalenteEmReais(50)).toBe(10);
  });

  it('1 ponto → R$0,20', () => {
    expect(calcularEquivalenteEmReais(1)).toBeCloseTo(0.20, 2);
  });

  it('0 pontos → R$0,00', () => {
    expect(calcularEquivalenteEmReais(0)).toBe(0);
  });

  it('retorna sempre 2 casas decimais (Number com toFixed)', () => {
    // 33 × 20 / 100 = 6.60 (não 6.6000...)
    const resultado = calcularEquivalenteEmReais(33);
    expect(resultado).toBe(6.60);
    // Verifica que é um número, não string
    expect(typeof resultado).toBe('number');
  });
});

// =============================================================
// calcularProximoBonus — bônus a cada 5 pedidos
// =============================================================
describe('calcularProximoBonus', () => {
  it('0 pedidos → 0 (estado inicial, mesmo retorno do múltiplo de 5)', () => {
    // Sem pedidos concluídos: 5 - (0 % 5) = 5 → retorna 0 (convenção do sistema)
    expect(calcularProximoBonus(0)).toBe(0);
  });

  it('1 pedido → faltam 4', () => {
    expect(calcularProximoBonus(1)).toBe(4);
  });

  it('2 pedidos → faltam 3', () => {
    expect(calcularProximoBonus(2)).toBe(3);
  });

  it('4 pedidos → falta 1', () => {
    expect(calcularProximoBonus(4)).toBe(1);
  });

  it('5 pedidos → 0 (acabou de receber o bônus)', () => {
    // Múltiplo de 5: bônus acabou de ser creditado → próximo em mais 5
    expect(calcularProximoBonus(5)).toBe(0);
  });

  it('6 pedidos → faltam 4 (novo ciclo)', () => {
    expect(calcularProximoBonus(6)).toBe(4);
  });

  it('10 pedidos → 0 (segundo múltiplo)', () => {
    expect(calcularProximoBonus(10)).toBe(0);
  });

  it('11 pedidos → faltam 4', () => {
    expect(calcularProximoBonus(11)).toBe(4);
  });

  it('constante BONUS_A_CADA_PEDIDOS é 5', () => {
    expect(BONUS_A_CADA_PEDIDOS).toBe(5);
  });

  it('constante BONUS_QUANTIDADE é 15', () => {
    expect(BONUS_QUANTIDADE).toBe(15);
  });
});

// =============================================================
// calcularResgate — desconto parcial vs total
// =============================================================
describe('calcularResgate', () => {
  // ---- Desconto PARCIAL: descontoMáximo ≤ totalCompra ----
  // O cliente usa TODOS os pontos porque o desconto não cobre a compra inteira.

  it('desconto parcial: 119 pts, compra R$100 → usa todos os 119 pts, desconto R$23,80', () => {
    // descontoMáximo = 119 × 20 / 100 = R$23,80 ≤ R$100 → parcial
    const { valorDesconto, pontosUsados } = calcularResgate(119, 100);

    expect(pontosUsados).toBe(119);
    expect(valorDesconto).toBeCloseTo(23.80, 2);
  });

  it('desconto parcial: 50 pts, compra R$50 → usa todos os 50 pts, desconto R$10,00', () => {
    // descontoMáximo = 50 × 20 / 100 = R$10,00 ≤ R$50 → parcial
    const { valorDesconto, pontosUsados } = calcularResgate(50, 50);

    expect(pontosUsados).toBe(50);
    expect(valorDesconto).toBeCloseTo(10.00, 2);
  });

  // ---- Desconto TOTAL: descontoMáximo > totalCompra ----
  // O cliente tem pontos suficientes para cobrir a compra inteira; usa só o necessário.

  it('desconto total: 200 pts, compra R$10 → usa 50 pts (Math.ceil), desconto R$10,00', () => {
    // descontoMáximo = 200 × 20 / 100 = R$40 > R$10 → total
    // pontosNecessários = Math.ceil(10 × 100 / 20) = Math.ceil(50) = 50
    const { valorDesconto, pontosUsados } = calcularResgate(200, 10);

    expect(pontosUsados).toBe(50);
    expect(valorDesconto).toBeCloseTo(10.00, 2);
  });

  it('desconto total com valor fracionário: 200 pts, compra R$9,99 → Math.ceil dos pts necessários', () => {
    // pontosNecessários = Math.ceil(9,99 × 100 / 20) = Math.ceil(49,95) = 50
    const { valorDesconto, pontosUsados } = calcularResgate(200, 9.99);

    expect(pontosUsados).toBe(50);
    expect(valorDesconto).toBeCloseTo(9.99, 2);
  });

  // ---- Caso de borda: desconto exatamente igual ao total da compra ----
  // descontoMáximo === totalCompra → cai no caminho de desconto PARCIAL (<=)

  it('caso de borda: 100 pts, compra R$20 → usa todos os 100 pts (desconto = total da compra)', () => {
    // descontoMáximo = 100 × 20 / 100 = R$20 = R$20 → ≤ → parcial
    const { valorDesconto, pontosUsados } = calcularResgate(100, 20);

    expect(pontosUsados).toBe(100);
    expect(valorDesconto).toBeCloseTo(20.00, 2);
  });

  it('constantes de conversão: PONTOS_PARA_RESGATAR=100, VALOR_RESGATE=20', () => {
    expect(PONTOS_PARA_RESGATAR).toBe(100);
    expect(VALOR_RESGATE).toBe(20);
  });
});
