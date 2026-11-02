/**
 * Utilitários para cálculos monetários precisos baseados em centavos inteiros.
 * NUNCA utilize números de ponto flutuante diretamente para representar saldos ou preços.
 */

/**
 * Formata um valor em centavos para a representação monetária BRL (R$ 0,00).
 * Exemplo: 1999 -> "R$ 19,99"
 */
export function formatCentsToBRL(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  return (safeCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Converte uma string no formato monetário (ex: "19,99" ou "R$ 1.250,50") em centavos inteiros.
 */
export function parseBRLToCents(val: string): number {
  if (!val) return 0;
  // Remove tudo que não for dígito, exceto vírgula ou ponto
  const clean = val.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Multiplica centavos por uma quantidade mantendo o resultado em centavos inteiros arredondados.
 */
export function multiplyCents(unitCents: number, quantity: number): number {
  return Math.round(unitCents * quantity);
}

/**
 * Aplica desconto monetário ou percentual retornando o valor final em centavos e o desconto em centavos.
 */
export function calculateDiscount(
  originalCents: number, 
  discountType: 'percent' | 'cents', 
  discountValue: number
): { finalCents: number; discountCents: number } {
  let discountCents = 0;
  if (discountType === 'percent') {
    const clampedPercent = Math.min(Math.max(discountValue, 0), 100);
    discountCents = Math.round((originalCents * clampedPercent) / 100);
  } else {
    discountCents = Math.min(Math.max(Math.round(discountValue), 0), originalCents);
  }
  
  const finalCents = Math.max(0, originalCents - discountCents);
  return { finalCents, discountCents };
}

/**
 * Calcula troco garantindo que não haja valor negativo.
 */
export function calculateChange(totalCents: number, receivedCents: number): number {
  if (receivedCents <= totalCents) return 0;
  return receivedCents - totalCents;
}
