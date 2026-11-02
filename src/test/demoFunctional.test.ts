import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../lib/db';
import { DEMO_TENANT_ID, DEMO_STORE_ID, seedDemoData } from '../lib/db/seed';
import { executeSaleAtomic } from '../lib/services/saleService';
import { useAuthStore } from '../store/useAuthStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
  useAuthStore.getState().logout();
});

describe('Fluxo demonstrativo local', () => {
  it('cria empresa, operadores, produtos, caixa e venda fictícios', async () => {
    await seedDemoData();
    expect((await db.tenants.get(DEMO_TENANT_ID))?.name).toContain('DEMO');
    expect(await db.user_roles.where('tenant_id').equals(DEMO_TENANT_ID).count()).toBe(2);
    expect(await db.products.where('[tenant_id+store_id]').equals([DEMO_TENANT_ID, DEMO_STORE_ID]).count()).toBeGreaterThan(0);
    expect(await db.cash_sessions.where('[tenant_id+store_id]').equals([DEMO_TENANT_ID, DEMO_STORE_ID]).count()).toBe(1);
    expect(await db.sales.where('[tenant_id+store_id]').equals([DEMO_TENANT_ID, DEMO_STORE_ID]).count()).toBe(1);
  });

  it('não duplica registros ao inicializar novamente', async () => {
    await seedDemoData();
    await seedDemoData();
    expect(await db.tenants.count()).toBe(1);
    expect(await db.sales.count()).toBe(1);
  });

  it('bloqueia e desbloqueia com PIN demonstrativo e rejeita PIN incorreto', async () => {
    await seedDemoData();
    const tenant = (await db.tenants.get(DEMO_TENANT_ID))!;
    const store = (await db.stores.get(DEMO_STORE_ID))!;
    const owner = (await db.user_roles.where('tenant_id').equals(DEMO_TENANT_ID).first())!;
    useAuthStore.getState().setSession(owner, tenant, store);
    useAuthStore.getState().lockSession();
    expect(await useAuthStore.getState().unlockWithPin('9999')).toBe(false);
    expect(await useAuthStore.getState().unlockWithPin('1234')).toBe(true);
    expect(useAuthStore.getState().isPinLocked).toBe(false);
  });

  it('grava venda, pagamento, baixa de estoque e outbox atomicamente', async () => {
    await seedDemoData();
    const product = (await db.products.get('prod-01'))!;
    const balanceId = `${DEMO_TENANT_ID}_${DEMO_STORE_ID}_${product.id}`;
    const before = (await db.inventory_balances.get(balanceId))!.current_stock;
    const result = await executeSaleAtomic({
      tenantId: DEMO_TENANT_ID, storeId: DEMO_STORE_ID, deviceId: 'dev-demo-terminal-01',
      cashSessionId: 'cash-session-demo-01', userId: 'user-demo-admin-01', userName: 'Ana',
      items: [{ productId: product.id, productName: product.name, sku: product.sku, quantity: 1, unitPriceCents: 550, unitCostCents: 280, discountCents: 0, totalCents: 550 }],
      payments: [{ paymentMethod: 'pix', amountCents: 550, receivedCents: 550, changeCents: 0 }],
      subtotalCents: 550, discountCents: 0, additionCents: 0, totalCents: 550
    });
    expect(result.sale.total_cents).toBe(550);
    expect((await db.inventory_balances.get(balanceId))!.current_stock).toBe(before-1);
    expect((await db.sale_payments.where('sale_id').equals(result.sale.id).first())?.amount_cents).toBe(550);
    expect(await db.sync_events.where('tenant_id').equals(DEMO_TENANT_ID).count()).toBeGreaterThan(0);
  });

  it('rejeita venda sem itens e pagamento insuficiente', async () => {
    await seedDemoData();
    const base = {
      tenantId: DEMO_TENANT_ID, storeId: DEMO_STORE_ID, deviceId: 'dev-demo-terminal-01',
      cashSessionId: 'cash-session-demo-01', userId: 'user-demo-admin-01', userName: 'Ana',
      items: [], payments: [], subtotalCents: 100, discountCents: 0, additionCents: 0, totalCents: 100
    };
    await expect(executeSaleAtomic(base)).rejects.toThrow('sem itens');
    await expect(executeSaleAtomic({ ...base, items: [{ productId:'prod-01', productName:'Produto', sku:'SKU', quantity:1, unitPriceCents:100, unitCostCents:50, discountCents:0, totalCents:100 }] })).rejects.toThrow('inferior');
  });
});
