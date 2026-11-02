import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { seedDemoData, DEMO_TENANT_ID, DEMO_STORE_ID, DEMO_DEVICE_ID, DEMO_USER_ID } from '../lib/db/seed';
import { createProduct, findProductByBarcodeOrSku } from '../lib/services/productService';

describe('FASE 2: Produtos, Variantes e Validação de SKU Único', () => {
  beforeEach(async () => {
    await seedDemoData(true);
  });

  it('deve cadastrar novo produto com SKU único e saldo inicial de estoque', async () => {
    const newProduct = await createProduct({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      sku: 'NOVO-SKU-001',
      barcode: '7899999999999',
      name: 'Produto Teste Unitário',
      unit: 'UN',
      costCents: 1000,
      priceCents: 2000,
      minStock: 5,
      initialStock: 15,
      userId: DEMO_USER_ID,
      userName: 'Ana Teste'
    });

    expect(newProduct.id).toBeDefined();
    expect(newProduct.sku).toBe('NOVO-SKU-001');

    const balance = await db.inventory_balances.get(`${DEMO_TENANT_ID}_${DEMO_STORE_ID}_${newProduct.id}`);
    expect(balance?.current_stock).toBe(15);
  });

  it('deve impedir cadastro de SKU duplicado no mesmo estabelecimento', async () => {
    await expect(
      createProduct({
        tenantId: DEMO_TENANT_ID,
        storeId: DEMO_STORE_ID,
        deviceId: DEMO_DEVICE_ID,
        sku: 'BEB-001',
        name: 'Tentativa de SKU Duplicado',
        unit: 'UN',
        costCents: 100,
        priceCents: 200,
        minStock: 1,
        userId: DEMO_USER_ID,
        userName: 'Ana Teste'
      })
    ).rejects.toThrow(/já está cadastrado/);
  });

  it('deve localizar produto pelo código de barras ou SKU', async () => {
    const foundByBarcode = await findProductByBarcodeOrSku(DEMO_TENANT_ID, DEMO_STORE_ID, '7894900010015');
    expect(foundByBarcode).toBeDefined();
    expect(foundByBarcode?.sku).toBe('BEB-001');

    const foundBySku = await findProductByBarcodeOrSku(DEMO_TENANT_ID, DEMO_STORE_ID, 'BEB-001');
    expect(foundBySku).toBeDefined();
    expect(foundBySku?.name).toContain('Coca-Cola');
  });
});
