import { db } from '../db';
import type { Product } from '../../types/database';
import { generateUUID } from '../utils/id';
import { getISOTimestamp } from '../utils/date';
import { enqueueSyncEvent } from '../sync/outbox';

export interface CreateProductParams {
  tenantId: string;
  storeId: string;
  deviceId: string;
  categoryId?: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  unit: string;
  costCents: number;
  priceCents: number;
  promoPriceCents?: number | null;
  minStock: number;
  initialStock?: number;
  hasVariants?: boolean;
  imageUrl?: string;
  userId: string;
  userName: string;
}

export async function createProduct(params: CreateProductParams): Promise<Product> {
  const normalizedSku = params.sku.trim().toUpperCase();

  const existingSku = await db.products
    .where('[tenant_id+store_id]')
    .equals([params.tenantId, params.storeId])
    .and((p) => p.sku === normalizedSku && !p.deleted_at)
    .first();

  if (existingSku) {
    throw new Error(`O SKU "${normalizedSku}" já está cadastrado para este estabelecimento.`);
  }

  const now = getISOTimestamp();
  const productId = generateUUID();

  const product: Product = {
    id: productId,
    tenant_id: params.tenantId,
    store_id: params.storeId,
    category_id: params.categoryId,
    sku: normalizedSku,
    barcode: params.barcode?.trim() || undefined,
    name: params.name.trim(),
    description: params.description?.trim(),
    unit: params.unit || 'UN',
    cost_cents: params.costCents,
    price_cents: params.priceCents,
    promo_price_cents: params.promoPriceCents || null,
    min_stock: params.minStock || 0,
    is_active: true,
    has_variants: !!params.hasVariants,
    image_url: params.imageUrl,
    version: 1,
    created_at: now,
    updated_at: now
  };

  const balanceId = `${params.tenantId}_${params.storeId}_${productId}`;
  const initialQty = params.initialStock || 0;

  await db.transaction('rw', [
    db.products, 
    db.inventory_balances, 
    db.inventory_movements, 
    db.sync_events
  ], async () => {
    await db.products.put(product);

    await db.inventory_balances.put({
      id: balanceId,
      tenant_id: params.tenantId,
      store_id: params.storeId,
      product_id: productId,
      variant_id: null,
      current_stock: initialQty,
      reserved_stock: 0,
      last_movement_at: now,
      updated_at: now
    });

    if (initialQty > 0) {
      await db.inventory_movements.put({
        id: generateUUID(),
        tenant_id: params.tenantId,
        store_id: params.storeId,
        product_id: productId,
        type: 'purchase',
        quantity: initialQty,
        unit_cost_cents: params.costCents,
        reason: 'Estoque inicial no cadastro do produto',
        user_id: params.userId,
        user_name: params.userName,
        created_at: now
      });
    }

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId,
      deviceId: params.deviceId,
      aggregateId: productId,
      aggregateType: 'product',
      operationType: 'INSERT',
      payload: { product, initial_stock: initialQty }
    });
  });

  return product;
}

export async function searchLocalProducts(
  tenantId: string,
  storeId: string,
  query: string
): Promise<Product[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return await db.products
      .where('[tenant_id+store_id]')
      .equals([tenantId, storeId])
      .and((p) => p.is_active && !p.deleted_at)
      .limit(50)
      .toArray();
  }

  return await db.products
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((p) => {
      if (!p.is_active || p.deleted_at) return false;
      const matchName = p.name.toLowerCase().includes(cleanQuery);
      const matchSku = p.sku.toLowerCase().includes(cleanQuery);
      const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(cleanQuery) : false;
      return matchName || matchSku || matchBarcode;
    })
    .limit(30)
    .toArray();
}

export async function findProductByBarcodeOrSku(
  tenantId: string,
  storeId: string,
  code: string
): Promise<Product | null> {
  const cleanCode = code.trim();
  if (!cleanCode) return null;

  const product = await db.products
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((p) => {
      if (!p.is_active || p.deleted_at) return false;
      return p.barcode === cleanCode || p.sku.toUpperCase() === cleanCode.toUpperCase();
    })
    .first();

  return product || null;
}

export async function exportProductsToCSV(tenantId: string, storeId: string): Promise<string> {
  const products = await db.products
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((p) => !p.deleted_at)
    .toArray();

  const headers = ['SKU', 'Codigo_Barras', 'Nome', 'Unidade', 'Custo_Centavos', 'Preco_Centavos', 'Preco_Promocional_Centavos', 'Estoque_Minimo', 'Ativo'];
  const rows = products.map((p) => [
    `"${p.sku}"`,
    `"${p.barcode || ''}"`,
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.unit}"`,
    p.cost_cents,
    p.price_cents,
    p.promo_price_cents || '',
    p.min_stock,
    p.is_active ? '1' : '0'
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function updateProduct(params: CreateProductParams & { productId: string }): Promise<Product> {
  const original = await db.products.get(params.productId);
  if (!original || original.tenant_id !== params.tenantId || original.store_id !== params.storeId || original.deleted_at) {
    throw new Error('Produto não encontrado nesta loja.');
  }
  const sku = params.sku.trim().toUpperCase();
  const conflict = await db.products.where('[tenant_id+store_id]')
    .equals([params.tenantId, params.storeId])
    .and(p => p.id !== original.id && p.sku === sku && !p.deleted_at).first();
  if (conflict) throw new Error('Este SKU já pertence a outro produto.');
  if (!params.name.trim() || !sku || !Number.isInteger(params.priceCents) || params.priceCents <= 0) {
    throw new Error('Informe nome, SKU e preço de venda válido.');
  }
  const product: Product = {
    ...original,
    category_id: params.categoryId || undefined,
    sku,
    barcode: params.barcode?.trim() || undefined,
    name: params.name.trim(),
    unit: params.unit.trim().toUpperCase() || 'UN',
    cost_cents: params.costCents,
    price_cents: params.priceCents,
    promo_price_cents: params.promoPriceCents ?? null,
    min_stock: params.minStock,
    version: original.version + 1,
    updated_at: getISOTimestamp()
  };
  await db.transaction('rw', db.products, db.sync_events, async () => {
    await db.products.put(product);
    await enqueueSyncEvent({
      tenantId: params.tenantId, storeId: params.storeId, deviceId: params.deviceId,
      aggregateId: product.id, aggregateType: 'product', operationType: 'UPDATE',
      payload: { product }
    });
  });
  return product;
}
