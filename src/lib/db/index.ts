import Dexie, { type EntityTable } from 'dexie';
import type {
  Tenant,
  Store,
  UserRole,
  Device,
  Category,
  Product,
  ProductVariant,
  InventoryMovement,
  InventoryBalance,
  CashSession,
  CashMovement,
  Sale,
  SaleItem,
  SalePayment,
  SaleRefund,
  Customer,
  Supplier,
  FinancialEntry,
  SyncEvent,
  AuditLog,
  IdempotencyKey
} from '../../types/database';

export class KonnexyDatabase extends Dexie {
  tenants!: EntityTable<Tenant, 'id'>;
  stores!: EntityTable<Store, 'id'>;
  user_roles!: EntityTable<UserRole, 'id'>;
  devices!: EntityTable<Device, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  products!: EntityTable<Product, 'id'>;
  product_variants!: EntityTable<ProductVariant, 'id'>;
  inventory_movements!: EntityTable<InventoryMovement, 'id'>;
  inventory_balances!: EntityTable<InventoryBalance, 'id'>;
  cash_sessions!: EntityTable<CashSession, 'id'>;
  cash_movements!: EntityTable<CashMovement, 'id'>;
  sales!: EntityTable<Sale, 'id'>;
  sale_items!: EntityTable<SaleItem, 'id'>;
  sale_payments!: EntityTable<SalePayment, 'id'>;
  sale_refunds!: EntityTable<SaleRefund, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  suppliers!: EntityTable<Supplier, 'id'>;
  financial_entries!: EntityTable<FinancialEntry, 'id'>;
  sync_events!: EntityTable<SyncEvent, 'event_id'>;
  audit_logs!: EntityTable<AuditLog, 'id'>;
  idempotency_keys!: EntityTable<IdempotencyKey, 'key'>;

  constructor() {
    super('KonnexyPDV_DB');

    this.version(1).stores({
      tenants: 'id, document, created_at',
      stores: 'id, tenant_id, code',
      user_roles: 'id, tenant_id, store_id, email, pin_hash',
      devices: 'id, tenant_id, store_id',
      categories: 'id, [tenant_id+store_id], name',
      products: 'id, [tenant_id+store_id], sku, barcode, name, category_id, is_active, version',
      product_variants: 'id, product_id, sku, barcode',
      inventory_movements: 'id, [tenant_id+store_id], product_id, reference_id, type, created_at',
      inventory_balances: 'id, [tenant_id+store_id], product_id',
      cash_sessions: 'id, [tenant_id+store_id], device_id, status, opened_at, closed_at',
      cash_movements: 'id, cash_session_id, [tenant_id+store_id], type, created_at',
      sales: 'id, [tenant_id+store_id], device_id, cash_session_id, sale_number, status, sync_status, created_at',
      sale_items: 'id, sale_id, product_id, sku',
      sale_payments: 'id, sale_id, payment_method, created_at',
      sale_refunds: 'id, sale_id, tenant_id, created_at',
      customers: 'id, tenant_id, name, document',
      suppliers: 'id, tenant_id, name, document',
      financial_entries: 'id, [tenant_id+store_id], type, status, due_date',
      sync_events: 'event_id, aggregate_id, [tenant_id+store_id], sync_status, created_at, retry_count',
      audit_logs: 'id, tenant_id, user_id, action, created_at',
      idempotency_keys: 'key, created_at'
    });
  }
}

export const db = new KonnexyDatabase();
