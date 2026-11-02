import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { seedDemoData, DEMO_TENANT_ID, DEMO_STORE_ID, DEMO_DEVICE_ID, DEMO_USER_ID } from '../lib/db/seed';
import { createProduct } from '../lib/services/productService';
import { executeSaleAtomic } from '../lib/services/saleService';
import { getProductStock } from '../lib/services/inventoryService';
import { SyncEngine } from '../lib/sync/syncEngine';
import { getPendingSyncCount } from '../lib/sync/outbox';

describe('FASE 5: Bateria de Testes de Aceitação e Estresse Offline', () => {
  beforeEach(async () => {
    await seedDemoData(true);
  });

  it('deve realizar 20 vendas consecutivas offline, abater estoque e preservar tudo no IndexedDB', async () => {
    // 1. Cadastra produto com 50 unidades de estoque inicial
    const prod = await createProduct({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      sku: 'STRESS-PROD-01',
      barcode: '7891234560001',
      name: 'Energético Monster 473ml',
      unit: 'UN',
      costCents: 500,
      priceCents: 1000,
      minStock: 5,
      initialStock: 50,
      userId: DEMO_USER_ID,
      userName: 'Operador Stress'
    });

    const stockInitial = await getProductStock(DEMO_TENANT_ID, DEMO_STORE_ID, prod.id);
    expect(stockInitial).toBe(50);

    // 2. Realiza 20 vendas offline consecutivas (1 unidade por venda)
    for (let i = 1; i <= 20; i++) {
      const saleResult = await executeSaleAtomic({
        tenantId: DEMO_TENANT_ID,
        storeId: DEMO_STORE_ID,
        deviceId: DEMO_DEVICE_ID,
        cashSessionId: 'cash-session-demo-01',
        userId: DEMO_USER_ID,
        userName: 'Operador Stress',
        items: [
          {
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            quantity: 1,
            unitPriceCents: 1000,
            unitCostCents: 500,
            discountCents: 0,
            totalCents: 1000
          }
        ],
        payments: [
          {
            paymentMethod: i % 2 === 0 ? 'pix' : 'money',
            amountCents: 1000,
            receivedCents: 1000,
            changeCents: 0
          }
        ],
        subtotalCents: 1000,
        discountCents: 0,
        additionCents: 0,
        totalCents: 1000
      });

      expect(saleResult.sale.status).toBe('completed');
    }

    // 3. Verifica abatimento exato de 20 unidades no estoque (50 - 20 = 30)
    const stockAfter20Sales = await getProductStock(DEMO_TENANT_ID, DEMO_STORE_ID, prod.id);
    expect(stockAfter20Sales).toBe(30);

    // 4. Verifica que foram gerados 20 registros de venda e 20 eventos pendentes no outbox
    const totalSales = await db.sales
      .where('[tenant_id+store_id]')
      .equals([DEMO_TENANT_ID, DEMO_STORE_ID])
      .toArray();

    // 1 do seed + 20 do estresse = 21 vendas
    expect(totalSales.length).toBe(21);

    const pendingCount = await getPendingSyncCount(DEMO_TENANT_ID, DEMO_STORE_ID);
    // 1 do createProduct + 20 das vendas = 21 eventos
    expect(pendingCount).toBe(21);

    // 5. Reconciliação em lote após retorno da rede:
    const engine = new SyncEngine({ batchSize: 50 });
    const syncRes = await engine.syncBatch(DEMO_TENANT_ID, DEMO_STORE_ID);
    expect(syncRes.success).toBe(true);
    expect(syncRes.processed).toBe(21);

    // 6. Prova de zero duplicação ao reenviar
    const reSync = await engine.syncBatch(DEMO_TENANT_ID, DEMO_STORE_ID);
    expect(reSync.processed).toBe(0);
  });

  it('deve preservar ambas as vendas e gerar divergência quando 2 terminais vendem o último item offline', async () => {
    // 1. Cadastra produto com apenas 1 unidade em estoque
    const lastItem = await createProduct({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: 'dev-01',
      sku: 'ULTIMO-ITEM-01',
      name: 'Item Único Raro',
      unit: 'UN',
      costCents: 1000,
      priceCents: 2500,
      minStock: 1,
      initialStock: 1,
      userId: DEMO_USER_ID,
      userName: 'Terminal 1'
    });

    // 2. Terminal 1 vende 1 unidade offline
    await executeSaleAtomic({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: 'dev-01',
      cashSessionId: 'cash-session-demo-01',
      userId: DEMO_USER_ID,
      userName: 'Terminal 1',
      items: [{
        productId: lastItem.id,
        productName: lastItem.name,
        sku: lastItem.sku,
        quantity: 1,
        unitPriceCents: 2500,
        unitCostCents: 1000,
        discountCents: 0,
        totalCents: 2500
      }],
      payments: [{ paymentMethod: 'pix', amountCents: 2500, receivedCents: 2500, changeCents: 0 }],
      subtotalCents: 2500,
      discountCents: 0,
      additionCents: 0,
      totalCents: 2500
    });

    // 3. Terminal 2 também vende 1 unidade do mesmo produto offline (concorrência offline)
    await executeSaleAtomic({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: 'dev-02',
      cashSessionId: 'cash-session-demo-01',
      userId: DEMO_USER_ID,
      userName: 'Terminal 2',
      items: [{
        productId: lastItem.id,
        productName: lastItem.name,
        sku: lastItem.sku,
        quantity: 1,
        unitPriceCents: 2500,
        unitCostCents: 1000,
        discountCents: 0,
        totalCents: 2500
      }],
      payments: [{ paymentMethod: 'money', amountCents: 2500, receivedCents: 2500, changeCents: 0 }],
      subtotalCents: 2500,
      discountCents: 0,
      additionCents: 0,
      totalCents: 2500
    });

    // 4. Ambas as vendas são preservadas contabilmente (imutabilidade contábil)
    const movements = await db.inventory_movements
      .where('product_id')
      .equals(lastItem.id)
      .and((m) => m.type === 'sale')
      .toArray();

    expect(movements.length).toBe(2);

    // 5. O saldo físico final reflete -1 (divergência física sinalizada para reposição)
    const stockAfter = await getProductStock(DEMO_TENANT_ID, DEMO_STORE_ID, lastItem.id);
    expect(stockAfter).toBe(-1);
  });

  it('deve garantir isolamento multi-tenant absoluto', async () => {
    // Tenant A
    await createProduct({
      tenantId: 'tenant-A',
      storeId: 'store-A',
      deviceId: 'dev-A',
      sku: 'SKU-COMPARTILHADO',
      name: 'Produto da Loja A',
      unit: 'UN',
      costCents: 100,
      priceCents: 200,
      minStock: 1,
      userId: 'user-A',
      userName: 'User A'
    });

    // Tenant B cadastra exatamente o mesmo SKU sem conflito
    const prodB = await createProduct({
      tenantId: 'tenant-B',
      storeId: 'store-B',
      deviceId: 'dev-B',
      sku: 'SKU-COMPARTILHADO',
      name: 'Produto da Loja B',
      unit: 'UN',
      costCents: 150,
      priceCents: 300,
      minStock: 1,
      userId: 'user-B',
      userName: 'User B'
    });

    expect(prodB.id).toBeDefined();

    // Consulta de produtos do Tenant A não retorna itens do Tenant B
    const prodsTenantA = await db.products
      .where('[tenant_id+store_id]')
      .equals(['tenant-A', 'store-A'])
      .toArray();

    expect(prodsTenantA.length).toBe(1);
    expect(prodsTenantA[0].name).toBe('Produto da Loja A');
  });
});
