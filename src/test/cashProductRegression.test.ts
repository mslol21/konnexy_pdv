import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../lib/db';
import { DEMO_DEVICE_ID, DEMO_STORE_ID, DEMO_TENANT_ID, DEMO_USER_ID, seedDemoData } from '../lib/db/seed';
import { openCashSession, getActiveCashSession } from '../lib/services/cashService';
import { updateProduct } from '../lib/services/productService';

beforeEach(async () => { await db.delete(); await db.open(); await seedDemoData(); });

describe('Correções de caixa e produtos', () => {
  it('abre caixa e mantém sessão no terminal selecionado', async () => {
    const deviceId = 'terminal-novo';
    const session = await openCashSession({
      tenantId: DEMO_TENANT_ID, storeId: DEMO_STORE_ID, deviceId,
      userId: DEMO_USER_ID, userName: 'Ana', initialAmountCents: 10000
    });
    expect(session.status).toBe('open');
    expect((await getActiveCashSession(DEMO_TENANT_ID, DEMO_STORE_ID, deviceId))?.id).toBe(session.id);
    await expect(openCashSession({
      tenantId: DEMO_TENANT_ID, storeId: DEMO_STORE_ID, deviceId,
      userId: DEMO_USER_ID, userName: 'Ana', initialAmountCents: 10000
    })).rejects.toThrow('Já existe');
  });

  it('edita preço e nome sem alterar estoque nem criar outro produto', async () => {
    const product = (await db.products.get('prod-01'))!;
    const balance = await db.inventory_balances.get(`${DEMO_TENANT_ID}_${DEMO_STORE_ID}_${product.id}`);
    await updateProduct({
      productId: product.id, tenantId: DEMO_TENANT_ID, storeId: DEMO_STORE_ID, deviceId: DEMO_DEVICE_ID,
      userId: DEMO_USER_ID, userName: 'Ana', sku: product.sku, name: 'Novo Nome', unit: product.unit,
      costCents: product.cost_cents, priceCents: 1590, minStock: product.min_stock
    });
    expect((await db.products.get(product.id))?.name).toBe('Novo Nome');
    expect((await db.products.get(product.id))?.price_cents).toBe(1590);
    expect((await db.inventory_balances.get(balance!.id))?.current_stock).toBe(balance!.current_stock);
    expect(await db.products.where('[tenant_id+store_id]').equals([DEMO_TENANT_ID, DEMO_STORE_ID]).count()).toBe(8);
  });
});
