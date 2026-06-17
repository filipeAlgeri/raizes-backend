/**
 * Funções puras de cálculo do programa de fidelidade.
 * Nenhuma dependência de banco de dados — testáveis isoladamente.
 *
 * Regras de negócio:
 *  - R$1,00 gasto = 1 ponto (Math.floor, sem fração)
 *  - 100 pontos = R$20,00 de desconto
 *  - +15 pontos de bônus a cada 5 pedidos ENTREGUE
 */

const PONTOS_POR_REAIS = 1;
const PONTOS_PARA_RESGATAR = 100;
const VALOR_RESGATE = 20;
const BONUS_A_CADA_PEDIDOS = 5;
const BONUS_QUANTIDADE = 15;

/**
 * Calcula quantos pontos são ganhos por uma compra.
 * Frações são descartadas: R$29,90 → 29 pontos.
 */
function calcularPontosGanhos(totalPedido) {
  return Math.floor(Number(totalPedido) * PONTOS_POR_REAIS);
}

/**
 * Converte saldo de pontos em valor monetário equivalente.
 * Exemplo: 100 pts → R$20,00 | 119 pts → R$23,80.
 */
function calcularEquivalenteEmReais(saldoPontos) {
  return Number((saldoPontos * VALOR_RESGATE / PONTOS_PARA_RESGATAR).toFixed(2));
}

/**
 * Calcula quantos pedidos faltam para o próximo bônus de +15 pts.
 * Retorna 0 quando o cliente está exatamente em um múltiplo de 5
 * (incluindo 0 pedidos — o estado inicial).
 *
 * Exemplos:
 *  0 pedidos → 0   (estado inicial / sem pedidos)
 *  1 pedido  → 4
 *  4 pedidos → 1
 *  5 pedidos → 0   (acabou de receber bônus)
 *  6 pedidos → 4
 */
function calcularProximoBonus(totalPedidos) {
  const faltam = BONUS_A_CADA_PEDIDOS - (totalPedidos % BONUS_A_CADA_PEDIDOS);
  return faltam === BONUS_A_CADA_PEDIDOS ? 0 : faltam;
}

/**
 * Calcula os valores de um resgate de pontos.
 *
 * Dois cenários:
 *  Desconto parcial: descontoMáximo ≤ totalCompra → usa TODOS os pontos disponíveis.
 *  Desconto total:   descontoMáximo > totalCompra  → usa APENAS os pontos necessários.
 *
 * @returns {{ valorDesconto: number, pontosUsados: number }}
 */
function calcularResgate(saldoAtual, totalCompra) {
  const totalCompraNum = Number(totalCompra);
  const descontoMaximo = Number((saldoAtual * VALOR_RESGATE / PONTOS_PARA_RESGATAR).toFixed(2));

  if (descontoMaximo <= totalCompraNum) {
    return { valorDesconto: descontoMaximo, pontosUsados: saldoAtual };
  }

  const pontosUsados = Math.ceil(totalCompraNum * PONTOS_PARA_RESGATAR / VALOR_RESGATE);
  return { valorDesconto: Number(totalCompraNum.toFixed(2)), pontosUsados };
}

module.exports = {
  calcularPontosGanhos,
  calcularEquivalenteEmReais,
  calcularProximoBonus,
  calcularResgate,
  PONTOS_POR_REAIS,
  PONTOS_PARA_RESGATAR,
  VALOR_RESGATE,
  BONUS_A_CADA_PEDIDOS,
  BONUS_QUANTIDADE,
};
