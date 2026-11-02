import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { seedDemoData, DEMO_TENANT_ID, DEMO_STORE_ID, DEMO_DEVICE_ID } from '../lib/db/seed';
import { createFinancialEntry, settleFinancialEntry, calculateDRE } from '../lib/services/financialService';

describe('FASE 3: Gestão Financeira, Contas a Pagar/Receber e DRE', () => {
  beforeEach(async () => {
    await seedDemoData(true);
  });

  it('deve criar conta a pagar e realizar a baixa com quitação', async () => {
    const entry = await createFinancialEntry({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      type: 'payable',
      category: 'Energia',
      description: 'Conta de Energia Elétrica Enel',
      amountCents: 35000, // R$ 350,00
      dueDate: '2026-11-20'
    });

    expect(entry.id).toBeDefined();
    expect(entry.status).toBe('pending');
    expect(entry.amount_cents).toBe(35000);

    // Realiza a baixa do título
    const settled = await settleFinancialEntry({
      entryId: entry.id,
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      paidAmountCents: 35000,
      notes: 'Pago via Débito em Conta'
    });

    expect(settled.status).toBe('paid');
    expect(settled.paid_date).toBeDefined();

    const fromDb = await db.financial_entries.get(entry.id);
    expect(fromDb?.status).toBe('paid');
  });

  it('deve apurar DRE calculando corretamente Receita Líquida, CMV e Margem Bruta', async () => {
    // No seed demo há 1 venda de:
    // 2 Coca-Colas (venda = 1100, custo = 2 * 280 = 560)
    // 1 Heineken com desconto de 90 (venda = 900, custo = 510)
    // Subtotal = 2090, Desconto = 90, Total Venda (Receita Líquida) = 2000
    // CMV Total = 560 + 510 = 1070 centavos (R$ 10,70)
    // Margem Bruta = 2000 - 1070 = 930 centavos (R$ 9,30)

    const dre = await calculateDRE(DEMO_TENANT_ID, DEMO_STORE_ID);

    expect(dre.grossSalesCents).toBe(2090);
    expect(dre.discountsCents).toBe(90);
    expect(dre.netSalesCents).toBe(2000);
    expect(dre.cmvCents).toBe(1070);
    expect(dre.grossMarginCents).toBe(930);
    expect(dre.grossMarginPercent).toBe(46.5); // 930 / 2000 = 46.5%
  });
});
