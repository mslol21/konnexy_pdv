import { db } from './index';
import type { 
  Tenant, 
  Store, 
  UserRole, 
  Device, 
  Category, 
  Product, 
  InventoryMovement, 
  InventoryBalance, 
  CashSession, 
  Sale, 
  SaleItem, 
  SalePayment 
} from '../../types/database';
import { getISOTimestamp } from '../utils/date';

export const DEMO_TENANT_ID = 'tenant-demo-konnexy-01';
export const DEMO_STORE_ID = 'store-demo-matriz-01';
export const DEMO_DEVICE_ID = 'dev-demo-terminal-01';
export const DEMO_USER_ID = 'user-demo-admin-01';
export const DEMO_CASHIER_ID = 'user-demo-caixa-01';

export async function isDatabaseInitialized(): Promise<boolean> {
  const tenantCount = await db.tenants.count();
  return tenantCount > 0;
}

export async function seedDemoData(force = false): Promise<void> {
  if (!force && (await isDatabaseInitialized())) {
    return;
  }

  const now = getISOTimestamp();

  if (force) {
    await db.transaction('rw', [
      db.tenants, db.stores, db.user_roles, db.devices, db.categories,
      db.products, db.product_variants, db.inventory_movements, db.inventory_balances,
      db.cash_sessions, db.cash_movements, db.sales, db.sale_items, db.sale_payments,
      db.sale_refunds, db.customers, db.suppliers, db.financial_entries,
      db.sync_events, db.audit_logs, db.idempotency_keys
    ], async () => {
      await Promise.all([
        db.tenants.clear(),
        db.stores.clear(),
        db.user_roles.clear(),
        db.devices.clear(),
        db.categories.clear(),
        db.products.clear(),
        db.product_variants.clear(),
        db.inventory_movements.clear(),
        db.inventory_balances.clear(),
        db.cash_sessions.clear(),
        db.cash_movements.clear(),
        db.sales.clear(),
        db.sale_items.clear(),
        db.sale_payments.clear(),
        db.sale_refunds.clear(),
        db.customers.clear(),
        db.suppliers.clear(),
        db.financial_entries.clear(),
        db.sync_events.clear(),
        db.audit_logs.clear(),
        db.idempotency_keys.clear()
      ]);
    });
  }

  const tenant: Tenant = {
    id: DEMO_TENANT_ID,
    name: 'Mercado & Conveniência Konnexy (DEMO)',
    document: '12.345.678/0001-90',
    plan: 'pro',
    created_at: now,
    updated_at: now
  };

  const store: Store = {
    id: DEMO_STORE_ID,
    tenant_id: DEMO_TENANT_ID,
    name: 'Konnexy Matriz Centro',
    code: 'MATRIZ',
    address: 'Av. Brasil, 1500 - Centro',
    phone: '(11) 98765-4321',
    created_at: now,
    updated_at: now
  };

  const users: UserRole[] = [
    {
      id: DEMO_USER_ID,
      tenant_id: DEMO_TENANT_ID,
      user_id: DEMO_USER_ID,
      store_id: DEMO_STORE_ID,
      role: 'owner',
      name: 'Ana Proprietária',
      email: 'ana@konnexydemo.com.br',
      pin_hash: '1234',
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: DEMO_CASHIER_ID,
      tenant_id: DEMO_TENANT_ID,
      user_id: DEMO_CASHIER_ID,
      store_id: DEMO_STORE_ID,
      role: 'cashier',
      name: 'Carlos Operador',
      email: 'carlos@konnexydemo.com.br',
      pin_hash: '0000',
      is_active: true,
      created_at: now,
      updated_at: now
    }
  ];

  const device: Device = {
    id: DEMO_DEVICE_ID,
    tenant_id: DEMO_TENANT_ID,
    store_id: DEMO_STORE_ID,
    name: 'Terminal PDV Balcão Principal',
    is_authorized: true,
    created_at: now
  };

  const categories: Category[] = [
    { id: 'cat-bebidas', tenant_id: DEMO_TENANT_ID, store_id: DEMO_STORE_ID, name: 'Bebidas & Refrigerantes', color: '#3b82f6', created_at: now, updated_at: now },
    { id: 'cat-mercearia', tenant_id: DEMO_TENANT_ID, store_id: DEMO_STORE_ID, name: 'Mercearia & Matinais', color: '#10b981', created_at: now, updated_at: now },
    { id: 'cat-snacks', tenant_id: DEMO_TENANT_ID, store_id: DEMO_STORE_ID, name: 'Snacks & Salgadinhos', color: '#f59e0b', created_at: now, updated_at: now },
    { id: 'cat-higiene', tenant_id: DEMO_TENANT_ID, store_id: DEMO_STORE_ID, name: 'Higiene & Limpeza', color: '#8b5cf6', created_at: now, updated_at: now }
  ];

  const products: Product[] = [
    {
      id: 'prod-01',
      tenant_id: DEMO_TENANT_ID,
      store_id: DEMO_STORE_ID,
      category_id: 'cat-bebidas',
      sku: 'BEB-001',
      barcode: '7894900010015',
      name: 'Refrigerante Coca-Cola Lata 350ml',
      description: 'Refrigerante de cola em lata 350ml gelado',
      unit: 'UN',
      cost_cents: 280,
      price_cents: 550,
      promo_price_cents: null,
      min_stock: 24,
      is_active: true,
      has_variants: false,
      version: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: 'prod-02',
      tenant_id: DEMO_TENANT_ID,
      store_id: DEMO_STORE_ID,
      category_id: 'cat-bebidas',
      sku: 'BEB-002',
      barcode: '7891991010832',
      name: 'Cerveja Heineken Long Neck 330ml',
      description: 'Cerveja puro malte garrafa 330ml',
      unit: 'UN',
      cost_cents: 510,
      price_cents: 990,
      promo_price_cents: 890,
      min_stock: 12,
      is_active: true,
      has_variants: false,
      version: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: 'prod-03',
      tenant_id: DEMO_TENANT_ID,
      store_id: DEMO_STORE_ID,
      category_id: 'cat-bebidas',
      sku: 'BEB-003',
      barcode: '7891000100103',
      name: 'Água Mineral Crystal Sem Gás 500ml',
      unit: 'UN',
      cost_cents: 110,
      price_cents: 300,
      promo_price_cents: null,
      min_stock: 30,
      is_active: true,
      has_variants: false,
      version: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: 'prod-04',
      tenant_id: DEMO_TENANT_ID,
      store_id: DEMO_STORE_ID,
      category_id: 'cat-snacks',
      sku: 'SNK-001',
      barcode: '7892840222949',
      name: 'Batata Ruffles Tradicional 76g',
      unit: 'UN',
      cost_cents: 420,
      price_cents: 850,
      promo_price_cents: null,
      min_stock: 15,
      is_active: true,
      has_variants: false,
      version: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: 'prod-05',
      tenant_id: DEMO_TENANT_ID,
      store_id: DEMO_STORE_ID,
      category_id: 'cat-snacks',
      sku: 'SNK-002',
      barcode: '7622210566355',
      name: 'Chocolate Bis Lacta Ao Leite 126g',
      unit: 'UN',
      cost_cents: 390,
      price_cents: 699,
      promo_price_cents: null,
      min_stock: 10,
      is_active: true,
      has_variants: false,
      version: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: 'prod-06',
      tenant_id: DEMO_TENANT_ID,
      store_id: DEMO_STORE_ID,
      category_id: 'cat-mercearia',
      sku: 'MER-001',
      barcode: '7891000300107',
      name: 'Café Torrado e Moído Melitta 500g',
      unit: 'UN',
      cost_cents: 1450,
      price_cents: 2290,
      promo_price_cents: null,
      min_stock: 8,
      is_active: true,
      has_variants: false,
      version: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: 'prod-07',
      tenant_id: DEMO_TENANT_ID,
      store_id: DEMO_STORE_ID,
      category_id: 'cat-mercearia',
      sku: 'MER-002',
      barcode: '7896006700014',
      name: 'Arroz Branco Camil Tipo 1 1kg',
      unit: 'UN',
      cost_cents: 480,
      price_cents: 720,
      promo_price_cents: null,
      min_stock: 20,
      is_active: true,
      has_variants: false,
      version: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: 'prod-08',
      tenant_id: DEMO_TENANT_ID,
      store_id: DEMO_STORE_ID,
      category_id: 'cat-higiene',
      sku: 'HIG-001',
      barcode: '7891030003504',
      name: 'Sabonete Dove Original 90g',
      unit: 'UN',
      cost_cents: 220,
      price_cents: 450,
      promo_price_cents: null,
      min_stock: 15,
      is_active: true,
      has_variants: false,
      version: 1,
      created_at: now,
      updated_at: now
    }
  ];

  const initialMovements: InventoryMovement[] = products.map((prod) => ({
    id: `mov-init-${prod.id}`,
    tenant_id: DEMO_TENANT_ID,
    store_id: DEMO_STORE_ID,
    product_id: prod.id,
    type: 'purchase',
    quantity: prod.min_stock * 2 + 10,
    unit_cost_cents: prod.cost_cents,
    reason: 'Estoque inicial de implantação do sistema',
    user_id: DEMO_USER_ID,
    user_name: 'Ana Proprietária',
    created_at: now
  }));

  const initialBalances: InventoryBalance[] = products.map((prod) => ({
    id: `${DEMO_TENANT_ID}_${DEMO_STORE_ID}_${prod.id}`,
    tenant_id: DEMO_TENANT_ID,
    store_id: DEMO_STORE_ID,
    product_id: prod.id,
    current_stock: prod.min_stock * 2 + 10,
    reserved_stock: 0,
    last_movement_at: now,
    updated_at: now
  }));

  const openSessionId = 'cash-session-demo-01';
  const cashSession: CashSession = {
    id: openSessionId,
    tenant_id: DEMO_TENANT_ID,
    store_id: DEMO_STORE_ID,
    device_id: DEMO_DEVICE_ID,
    opened_by_user_id: DEMO_USER_ID,
    opened_by_user_name: 'Ana Proprietária',
    initial_amount_cents: 15000,
    opened_at: now,
    status: 'open',
    notes: 'Abertura de caixa com fundo de troco padrão'
  };

  const sampleSaleId = 'sale-demo-sample-01';
  const sampleSale: Sale = {
    id: sampleSaleId,
    tenant_id: DEMO_TENANT_ID,
    store_id: DEMO_STORE_ID,
    device_id: DEMO_DEVICE_ID,
    cash_session_id: openSessionId,
    user_id: DEMO_CASHIER_ID,
    user_name: 'Carlos Operador',
    sale_number: 1001,
    subtotal_cents: 2090,
    discount_cents: 90,
    addition_cents: 0,
    total_cents: 2000,
    status: 'completed',
    notes: 'Venda de demonstração inicial',
    sync_status: 'synced',
    version: 1,
    created_at: now
  };

  const sampleItems: SaleItem[] = [
    {
      id: 'item-01',
      sale_id: sampleSaleId,
      product_id: 'prod-01',
      product_name: 'Refrigerante Coca-Cola Lata 350ml',
      sku: 'BEB-001',
      quantity: 2,
      unit_price_cents: 550,
      unit_cost_cents: 280,
      discount_cents: 0,
      total_cents: 1100
    },
    {
      id: 'item-02',
      sale_id: sampleSaleId,
      product_id: 'prod-02',
      product_name: 'Cerveja Heineken Long Neck 330ml',
      sku: 'BEB-002',
      quantity: 1,
      unit_price_cents: 990,
      unit_cost_cents: 510,
      discount_cents: 90,
      total_cents: 900
    }
  ];

  const samplePayment: SalePayment = {
    id: 'pay-01',
    sale_id: sampleSaleId,
    payment_method: 'pix',
    amount_cents: 2000,
    change_cents: 0,
    received_cents: 2000,
    created_at: now
  };

  await db.transaction('rw', [
    db.tenants, db.stores, db.user_roles, db.devices, db.categories,
    db.products, db.inventory_movements, db.inventory_balances,
    db.cash_sessions, db.sales, db.sale_items, db.sale_payments
  ], async () => {
    await db.tenants.put(tenant);
    await db.stores.put(store);
    await db.user_roles.bulkPut(users);
    await db.devices.put(device);
    await db.categories.bulkPut(categories);
    await db.products.bulkPut(products);
    await db.inventory_movements.bulkPut(initialMovements);
    await db.inventory_balances.bulkPut(initialBalances);
    await db.cash_sessions.put(cashSession);
    await db.sales.put(sampleSale);
    await db.sale_items.bulkPut(sampleItems);
    await db.sale_payments.put(samplePayment);
  });
}
