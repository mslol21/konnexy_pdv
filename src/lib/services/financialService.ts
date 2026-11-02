import { db } from '../db';
import type { FinancialEntry, FinancialType } from '../../types/database';
import { generateUUID } from '../utils/id';
import { getISOTimestamp } from '../utils/date';
import { enqueueSyncEvent } from '../sync/outbox';

export interface CreateFinancialEntryParams {
  tenantId: string;
  storeId: string;
  deviceId: string;
  type: FinancialType;
  category: string;
  description: string;
  amountCents: number;
  dueDate: string;
  customerId?: string;
  supplierId?: string;
  notes?: string;
}

export interface SettleEntryParams {
  entryId: string;
  tenantId: string;
  storeId: string;
  deviceId: string;
  paidAmountCents: number;
  paidDate?: string;
  notes?: string;
}

export interface DREMetrics {
  grossSalesCents: number; // Receita Bruta
  discountsCents: number; // Descontos
  netSalesCents: number; // Receita Líquida
  cmvCents: number; // Custo das Mercadorias Vendidas
  grossMarginCents: number; // Margem Bruta = Net Sales - CMV
  grossMarginPercent: number; // Margem %
  operatingExpensesCents: number; // Despesas Operacionais pagas no período
  estimatedProfitCents: number; // Lucro Operacional Estimado
}

/**
 * Cria um título no financeiro (Conta a Pagar ou Conta a Receber).
 */
export async function createFinancialEntry(params: CreateFinancialEntryParams): Promise<FinancialEntry> {
  const now = getISOTimestamp();
  const entryId = generateUUID();

  const entry: FinancialEntry = {
    id: entryId,
    tenant_id: params.tenantId,
    store_id: params.storeId,
    type: params.type,
    category: params.category,
    description: params.description,
    amount_cents: params.amountCents,
    due_date: params.dueDate,
    status: 'pending',
    customer_id: params.customerId,
    supplier_id: params.supplierId,
    notes: params.notes,
    created_at: now,
    updated_at: now
  };

  await db.transaction('rw', [db.financial_entries, db.sync_events], async () => {
    await db.financial_entries.put(entry);

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId,
      deviceId: params.deviceId,
      aggregateId: entryId,
      aggregateType: 'financial_entry',
      operationType: 'INSERT',
      payload: { entry }
    });
  });

  return entry;
}

/**
 * Realiza a baixa (pagamento/recebimento) de um título financeiro.
 */
export async function settleFinancialEntry(params: SettleEntryParams): Promise<FinancialEntry> {
  const now = getISOTimestamp();

  return await db.transaction('rw', [db.financial_entries, db.sync_events], async () => {
    const entry = await db.financial_entries.get(params.entryId);
    if (!entry) throw new Error('Lançamento financeiro não encontrado.');

    entry.status = 'paid';
    entry.paid_date = params.paidDate || now.slice(0, 10);
    entry.updated_at = now;
    if (params.notes) {
      entry.notes = entry.notes ? `${entry.notes} | Baixa: ${params.notes}` : params.notes;
    }

    await db.financial_entries.put(entry);

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId,
      deviceId: params.deviceId,
      aggregateId: entry.id,
      aggregateType: 'financial_entry',
      operationType: 'UPDATE',
      payload: { entry, paidAmountCents: params.paidAmountCents }
    });

    return entry;
  });
}

/**
 * Calcula DRE Gerencial e Margem Bruta Real:
 * Receita Bruta - Descontos = Receita Líquida
 * Receita Líquida - CMV = Margem Bruta
 * Margem Bruta - Despesas Operacionais = Lucro Operacional Estimado
 */
export async function calculateDRE(
  tenantId: string, 
  storeId: string, 
  startDateIso?: string, 
  endDateIso?: string
): Promise<DREMetrics> {
  // 1. Busca vendas completadas do período
  let salesQuery = db.sales
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((s) => s.status === 'completed');

  if (startDateIso && endDateIso) {
    salesQuery = salesQuery.and((s) => s.created_at >= startDateIso && s.created_at <= endDateIso);
  }

  const sales = await salesQuery.toArray();

  let grossSalesCents = 0;
  let discountsCents = 0;
  let netSalesCents = 0;
  let cmvCents = 0;

  for (const s of sales) {
    grossSalesCents += s.subtotal_cents;
    discountsCents += s.discount_cents;
    netSalesCents += s.total_cents;

    // Busca itens para apurar o CMV exato
    const items = await db.sale_items.where('sale_id').equals(s.id).toArray();
    for (const item of items) {
      cmvCents += (item.unit_cost_cents * item.quantity);
    }
  }

  const grossMarginCents = Math.max(0, netSalesCents - cmvCents);
  const grossMarginPercent = netSalesCents > 0 ? (grossMarginCents / netSalesCents) * 100 : 0;

  // 2. Busca despesas operacionais pagas no período
  let payablesQuery = db.financial_entries
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((f) => f.type === 'payable' && f.status === 'paid');

  if (startDateIso && endDateIso) {
    payablesQuery = payablesQuery.and((f) => !!f.paid_date && f.paid_date >= startDateIso && f.paid_date <= endDateIso);
  }

  const paidPayables = await payablesQuery.toArray();
  const operatingExpensesCents = paidPayables.reduce((acc, f) => acc + f.amount_cents, 0);

  const estimatedProfitCents = grossMarginCents - operatingExpensesCents;

  return {
    grossSalesCents,
    discountsCents,
    netSalesCents,
    cmvCents,
    grossMarginCents,
    grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
    operatingExpensesCents,
    estimatedProfitCents
  };
}
