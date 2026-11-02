import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { seedDemoData, DEMO_TENANT_ID, DEMO_STORE_ID } from '../lib/db/seed';
import { enqueueSyncEvent, getPendingSyncCount } from '../lib/sync/outbox';

describe('Persistência Local IndexedDB (Dexie) e Outbox Pattern', () => {
  beforeEach(async () => {
    await seedDemoData(true);
  });

  it('deve inicializar o catálogo demonstrativo com sucesso', async () => {
    const productsCount = await db.products.count();
    const categoriesCount = await db.categories.count();
    const cashCount = await db.cash_sessions.count();

    expect(productsCount).toBeGreaterThanOrEqual(8);
    expect(categoriesCount).toBeGreaterThanOrEqual(4);
    expect(cashCount).toBe(1);
  });

  it('deve isolar produtos por tenant_id e store_id', async () => {
    const productsLoja1 = await db.products
      .where('[tenant_id+store_id]')
      .equals([DEMO_TENANT_ID, DEMO_STORE_ID])
      .toArray();

    expect(productsLoja1.length).toBeGreaterThan(0);

    const productsOutraLoja = await db.products
      .where('[tenant_id+store_id]')
      .equals(['outro-tenant', 'outra-loja'])
      .toArray();

    expect(productsOutraLoja.length).toBe(0);
  });

  it('deve enfileirar eventos no Outbox com status pending e dados íntegros', async () => {
    const event = await enqueueSyncEvent({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: 'dev-teste',
      aggregateId: 'sale-teste-01',
      aggregateType: 'sale',
      operationType: 'SALE_CREATE',
      payload: { total_cents: 3500, items_count: 2 }
    });

    expect(event.event_id).toBeDefined();
    expect(event.sync_status).toBe('pending');

    const pendingCount = await getPendingSyncCount(DEMO_TENANT_ID, DEMO_STORE_ID);
    expect(pendingCount).toBe(1);
  });

  it('deve garantir valores monetários dos produtos como inteiros', async () => {
    const products = await db.products.toArray();
    for (const prod of products) {
      expect(Number.isInteger(prod.price_cents)).toBe(true);
      expect(Number.isInteger(prod.cost_cents)).toBe(true);
      if (prod.promo_price_cents !== null && prod.promo_price_cents !== undefined) {
        expect(Number.isInteger(prod.promo_price_cents)).toBe(true);
      }
    }
  });
});
