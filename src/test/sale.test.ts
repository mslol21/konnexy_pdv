import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { seedDemoData, DEMO_TENANT_ID, DEMO_STORE_ID, DEMO_DEVICE_ID, DEMO_USER_ID } from '../lib/db/seed';
import { executeSaleAtomic, refundSaleAtomic } from '../lib/services/saleService';
import { getProductStock } from '../lib/services/inventoryService';

describe('FASE 2: Transação Atômica do PDV e Estorno Auditado', () => {
  beforeEach(async () => {
    await seedDemoData(true);
  });

  it('deve executar uma venda atômica offline com multi-pagamento e abater estoque', async () => {
    // 1. Obtém estoque antes da venda
    const stockBefore = await getProductStock(DEMO_TENANT_ID, DEMO_STORE_ID, 'prod-01');

    // 2. Executa venda de 2 unidades de prod-01 (Coca-Cola, unit 550 centavos = 1100 total)
    const saleResult = await executeSaleAtomic({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      cashSessionId: 'cash-session-demo-01',
      userId: DEMO_USER_ID,
      userName: 'Ana Teste',
      items: [
        {
          productId: 'prod-01',
          productName: 'Coca-Cola',
          sku: 'BEB-001',
          quantity: 2,
          unitPriceCents: 550,
          unitCostCents: 280,
          discountCents: 0,
          totalCents: 1100
        }
      ],
      payments: [
        {
          paymentMethod: 'money',
          amountCents: 1100,
          receivedCents: 2000,
          changeCents: 900
        }
      ],
      subtotalCents: 1100,
      discountCents: 0,
      additionCents: 0,
      totalCents: 1100
    });

    expect(saleResult.sale.id).toBeDefined();
    expect(saleResult.sale.status).toBe('completed');
    expect(saleResult.sale.total_cents).toBe(1100);

    // 3. Verifica abatimento de estoque na projeção
    const stockAfter = await getProductStock(DEMO_TENANT_ID, DEMO_STORE_ID, 'prod-01');
    expect(stockAfter).toBe(stockBefore - 2);

    // 4. Verifica geração de movimento imutável
    const movements = await db.inventory_movements
      .where('reference_id')
      .equals(saleResult.sale.id)
      .toArray();

    expect(movements.length).toBe(1);
    expect(movements[0].quantity).toBe(-2);
    expect(movements[0].type).toBe('sale');

    // 5. Verifica lançamento em dinheiro no caixa
    const cashMovs = await db.cash_movements
      .where('cash_session_id')
      .equals('cash-session-demo-01')
      .and((m) => m.reason.includes(String(saleResult.sale.sale_number)))
      .toArray();

    expect(cashMovs.length).toBe(1);
    expect(cashMovs[0].amount_cents).toBe(1100);

    // 6. Verifica evento gerado na fila Outbox
    const outboxEvent = await db.sync_events
      .where('aggregate_id')
      .equals(saleResult.sale.id)
      .first();

    expect(outboxEvent).toBeDefined();
    expect(outboxEvent?.operation_type).toBe('SALE_CREATE');
    expect(outboxEvent?.sync_status).toBe('pending');
  });

  it('deve estornar venda recompondo o estoque e gerando movimento compensatório no caixa', async () => {
    // 1. Cria uma venda
    const saleResult = await executeSaleAtomic({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      cashSessionId: 'cash-session-demo-01',
      userId: DEMO_USER_ID,
      userName: 'Ana Teste',
      items: [
        {
          productId: 'prod-02',
          productName: 'Heineken',
          sku: 'BEB-002',
          quantity: 3,
          unitPriceCents: 990,
          unitCostCents: 510,
          discountCents: 0,
          totalCents: 2970
        }
      ],
      payments: [
        {
          paymentMethod: 'money',
          amountCents: 2970,
          receivedCents: 3000,
          changeCents: 30
        }
      ],
      subtotalCents: 2970,
      discountCents: 0,
      additionCents: 0,
      totalCents: 2970
    });

    const stockBeforeRefund = await getProductStock(DEMO_TENANT_ID, DEMO_STORE_ID, 'prod-02');

    // 2. Realiza o estorno auditado
    const refund = await refundSaleAtomic(
      saleResult.sale.id,
      'Cliente desistiu da compra',
      DEMO_USER_ID,
      'Ana Gerente',
      DEMO_DEVICE_ID
    );

    expect(refund.id).toBeDefined();
    expect(refund.amount_cents).toBe(2970);

    // 3. Verifica se a venda mudou de status para canceled
    const updatedSale = await db.sales.get(saleResult.sale.id);
    expect(updatedSale?.status).toBe('canceled');
    expect(updatedSale?.cancel_reason).toBe('Cliente desistiu da compra');

    // 4. Verifica se o estoque foi recomposto (+3)
    const stockAfterRefund = await getProductStock(DEMO_TENANT_ID, DEMO_STORE_ID, 'prod-02');
    expect(stockAfterRefund).toBe(stockBeforeRefund + 3);

    // 5. Verifica se foi lançado o estorno no caixa
    const refundCashMovs = await db.cash_movements
      .where('cash_session_id')
      .equals('cash-session-demo-01')
      .and((m) => m.type === 'refund')
      .toArray();

    expect(refundCashMovs.length).toBeGreaterThan(0);
  });
});
