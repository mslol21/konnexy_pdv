import { db } from '../db';
import type { Customer, Supplier, Sale } from '../../types/database';
import { generateUUID } from '../utils/id';
import { getISOTimestamp } from '../utils/date';
import { enqueueSyncEvent } from '../sync/outbox';

export interface CreateCustomerParams {
  tenantId: string;
  deviceId: string;
  name: string;
  document?: string; // CPF
  email?: string;
  phone?: string;
}

export interface CreateSupplierParams {
  tenantId: string;
  deviceId: string;
  name: string;
  document?: string; // CNPJ
  contactName?: string;
  phone?: string;
  email?: string;
}

export async function createCustomer(params: CreateCustomerParams): Promise<Customer> {
  const now = getISOTimestamp();
  const customerId = generateUUID();

  const customer: Customer = {
    id: customerId,
    tenant_id: params.tenantId,
    name: params.name.trim(),
    document: params.document?.trim(),
    email: params.email?.trim(),
    phone: params.phone?.trim(),
    created_at: now,
    updated_at: now
  };

  await db.transaction('rw', [db.customers, db.sync_events], async () => {
    await db.customers.put(customer);

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: 'global',
      deviceId: params.deviceId,
      aggregateId: customerId,
      aggregateType: 'customer',
      operationType: 'INSERT',
      payload: { customer }
    });
  });

  return customer;
}

export async function searchCustomers(tenantId: string, query: string): Promise<Customer[]> {
  const clean = query.trim().toLowerCase();
  if (!clean) {
    return await db.customers.where('tenant_id').equals(tenantId).limit(30).toArray();
  }

  return await db.customers
    .where('tenant_id')
    .equals(tenantId)
    .and((c) => {
      const matchName = c.name.toLowerCase().includes(clean);
      const matchDoc = c.document ? c.document.includes(clean) : false;
      return matchName || matchDoc;
    })
    .limit(20)
    .toArray();
}

export async function createSupplier(params: CreateSupplierParams): Promise<Supplier> {
  const now = getISOTimestamp();
  const supplierId = generateUUID();

  const supplier: Supplier = {
    id: supplierId,
    tenant_id: params.tenantId,
    name: params.name.trim(),
    document: params.document?.trim(),
    contact_name: params.contactName?.trim(),
    phone: params.phone?.trim(),
    email: params.email?.trim(),
    created_at: now
  };

  await db.transaction('rw', [db.suppliers, db.sync_events], async () => {
    await db.suppliers.put(supplier);

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: 'global',
      deviceId: params.deviceId,
      aggregateId: supplierId,
      aggregateType: 'supplier',
      operationType: 'INSERT',
      payload: { supplier }
    });
  });

  return supplier;
}

export async function listSuppliers(tenantId: string): Promise<Supplier[]> {
  return await db.suppliers.where('tenant_id').equals(tenantId).toArray();
}

/**
 * Consulta histórico de compras de um cliente pelo ID.
 */
export async function getCustomerSales(tenantId: string, customerId: string): Promise<Sale[]> {
  return await db.sales
    .where('tenant_id')
    .equals(tenantId)
    .and((s) => s.customer_id === customerId)
    .reverse()
    .sortBy('created_at');
}
