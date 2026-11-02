import { describe, it, expect } from 'vitest';
import { 
  formatCentsToBRL, 
  parseBRLToCents, 
  multiplyCents, 
  calculateDiscount, 
  calculateChange 
} from '../lib/utils/currency';

describe('Cálculos Financeiros em Centavos Inteiros (Zero Floating Point Errors)', () => {
  it('deve formatar centavos para moeda BRL corretamente', () => {
    // Note: Node/jsdom pode usar espaço sem quebra (NBSP / U+00A0 ou U+202F) no formato pt-BR
    const formatted = formatCentsToBRL(1999);
    expect(formatted).toMatch(/R\$\s*19,99/);
    expect(formatCentsToBRL(0)).toMatch(/R\$\s*0,00/);
    expect(formatCentsToBRL(105050)).toMatch(/R\$\s*1\.050,50/);
  });

  it('deve converter strings monetárias para centavos inteiros', () => {
    expect(parseBRLToCents('19,99')).toBe(1999);
    expect(parseBRLToCents('R$ 1.250,50')).toBe(125050);
    expect(parseBRLToCents('0,05')).toBe(5);
    expect(parseBRLToCents('')).toBe(0);
  });

  it('deve multiplicar valor unitário por quantidade sem erros de precisão decimal', () => {
    // 3 unidades a R$ 19,99 = R$ 59,97 (5997 centavos)
    const total = multiplyCents(1999, 3);
    expect(total).toBe(5997);
  });

  it('deve calcular desconto percentual e fixo em centavos', () => {
    // 10% de desconto em R$ 100,00 (10000 centavos) = R$ 10,00 (1000 centavos)
    const resPercent = calculateDiscount(10000, 'percent', 10);
    expect(resPercent.discountCents).toBe(1000);
    expect(resPercent.finalCents).toBe(9000);

    // Desconto fixo de R$ 15,50 em R$ 50,00
    const resFixed = calculateDiscount(5000, 'cents', 1550);
    expect(resFixed.discountCents).toBe(1550);
    expect(resFixed.finalCents).toBe(3450);

    // Desconto maior que o total deve limitar a zero (não ficar negativo)
    const resExcess = calculateDiscount(1000, 'cents', 2500);
    expect(resExcess.finalCents).toBe(0);
    expect(resExcess.discountCents).toBe(1000);
  });

  it('deve calcular troco sem permitir valores negativos', () => {
    expect(calculateChange(2000, 5000)).toBe(3000);
    expect(calculateChange(2000, 2000)).toBe(0);
    expect(calculateChange(2000, 1500)).toBe(0);
  });
});
