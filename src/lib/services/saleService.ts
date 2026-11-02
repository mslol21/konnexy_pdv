import { db } from '../db';
import type { 
  Sale, 
  SaleItem, 
  SalePayment, 
  SaleRefund, 
  InventoryMovement, 
  CashMovement,
  PaymentMethod 
} from '../../types/database';
import { generateUUID } from '../utils/id';
import { getISOTimestamp } from '../utils/date';
import { enqueueSyncEvent } from '../sync/outbox';

export interface CartItemParam {
  productId: string;
  variantId?: string | null;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  discountCents: number;
  totalCents: number;
}

export interface PaymentParam {
  paymentMethod: PaymentMethod;
  amountCents: number;
  receivedCents: number;
  changeCents: number;
  installments?: number;
  cardBrand?: string;
}

export interface ExecuteSaleParams {
  tenantId: string;
  storeId: string;
  deviceId: string;
  cashSessionId: string;
  userId: string;
  userName: string;
  items: CartItemParam[];
  payments: PaymentParam[];
  subtotalCents: number;
  discountCents: number;
  additionCents: number;
  totalCents: number;
  customerId?: string | null;
  customerName?: string;
  customerDocument?: string;
  notes?: string;
}

export interface SaleTransactionResult {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
}

export async function executeSaleAtomic(params: ExecuteSaleParams): Promise<SaleTransactionResult> {
  if (params.items.length === 0) {
    throw new Error('Não é possível finalizar uma venda sem itens.');
  }

  const paymentsTotal = params.payments.reduce((acc, p) => acc + p.amountCents, 0);
  if (paymentsTotal < params.totalCents) {
    throw new Error(`Total pago (R$ ${(paymentsTotal/100).toFixed(2)}) é inferior ao total da venda (R$ ${(params.totalCents/100).toFixed(2)}).`);
  }

  const now = getISOTimestamp();
  const saleId = generateUUID();

  return await db.transaction('rw', [
    db.sales, 
    db.sale_items, 
    db.sale_payments, 
    db.inventory_movements, 
    db.inventory_balances, 
    db.cash_movements, 
    db.sync_events
  ], async () => {
    const lastSale = await db.sales
      .where('[tenant_id+store_id]')
      .equals([params.tenantId, params.storeId])
      .reverse()
      .sortBy('sale_number');

    const nextSaleNumber = lastSale.length > 0 && lastSale[0].sale_number ? lastSale[0].sale_number + 1 : 1001;

    const sale: Sale = {
      id: saleId,
      tenant_id: params.tenantId,
      store_id: params.storeId,
      device_id: params.deviceId,
      cash_session_id: params.cashSessionId,
      user_id: params.userId,
      user_name: params.userName,
      customer_id: params.customerId || null,
      customer_name: params.customerName,
      customer_document: params.customerDocument,
      sale_number: nextSaleNumber,
      subtotal_cents: params.subtotalCents,
      discount_cents: params.discountCents,
      addition_cents: params.additionCents,
      total_cents: params.totalCents,
      status: 'completed',
      notes: params.notes,
      sync_status: 'pending',
      version: 1,
      created_at: now
    };

    await db.sales.put(sale);

    const saleItems: SaleItem[] = params.items.map((item) => ({
      id: generateUUID(),
      sale_id: saleId,
      product_id: item.productId,
      variant_id: item.variantId || null,
      product_name: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      unit_cost_cents: item.unitCostCents,
      discount_cents: item.discountCents,
      total_cents: item.totalCents
    }));

    await db.sale_items.bulkPut(saleItems);

    const salePayments: SalePayment[] = params.payments.map((pay) => ({
      id: generateUUID(),
      sale_id: saleId,
      payment_method: pay.paymentMethod,
      amount_cents: pay.amountCents,
      change_cents: pay.changeCents,
      received_cents: pay.receivedCents,
      installments: pay.installments || 1,
      card_brand: pay.cardBrand,
      created_at: now
    }));

    await db.sale_payments.bulkPut(salePayments);

    for (const item of params.items) {
      const movementId = generateUUID();
      const balanceId = `${params.tenantId}_${params.storeId}_${item.productId}${item.variantId ? `_${item.variantId}` : ''}`;

      const mov: InventoryMovement = {
        id: movementId,
        tenant_id: params.tenantId,
        store_id: params.storeId,
        product_id: item.productId,
        variant_id: item.variantId || null,
        type: 'sale',
        quantity: -item.quantity,
        unit_cost_cents: item.unitCostCents,
        reason: `Venda #${nextSaleNumber}`,
        reference_id: saleId,
        user_id: params.userId,
        user_name: params.userName,
        created_at: now
      };

      await db.inventory_movements.put(mov);

      const currentBalance = await db.inventory_balances.get(balanceId);
      const prevStock = currentBalance ? currentBalance.current_stock : 0;
      const newStock = prevStock - item.quantity;

      await db.inventory_balances.put({
        id: balanceId,
        tenant_id: params.tenantId,
        store_id: params.storeId,
        product_id: item.productId,
        variant_id: item.variantId || null,
        current_stock: newStock,
        reserved_stock: currentBalance ? currentBalance.reserved_stock : 0,
        last_movement_at: now,
        updated_at: now
      });
    }

    for (const pay of params.payments) {
      if (pay.paymentMethod === 'money') {
        const cashMovement: CashMovement = {
          id: generateUUID(),
          cash_session_id: params.cashSessionId,
          tenant_id: params.tenantId,
          store_id: params.storeId,
          type: 'sale',
          amount_cents: pay.amountCents,
          payment_method: 'money',
          reason: `Recebimento em dinheiro Venda #${nextSaleNumber}`,
          user_id: params.userId,
          user_name: params.userName,
          created_at: now
        };
        await db.cash_movements.put(cashMovement);
      }
    }

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId,
      deviceId: params.deviceId,
      aggregateId: saleId,
      aggregateType: 'sale',
      operationType: 'SALE_CREATE',
      payload: {
        sale,
        items: saleItems,
        payments: salePayments
      }
    });

    return {
      sale,
      items: saleItems,
      payments: salePayments
    };
  });
}

export async function refundSaleAtomic(
  saleId: string, 
  reason: string, 
  userId: string, 
  userName: string,
  deviceId: string
): Promise<SaleRefund> {
  const now = getISOTimestamp();
  const refundId = generateUUID();

  return await db.transaction('rw', [
    db.sales, 
    db.sale_items, 
    db.sale_payments, 
    db.sale_refunds, 
    db.inventory_movements, 
    db.inventory_balances, 
    db.cash_movements, 
    db.sync_events
  ], async () => {
    const sale = await db.sales.get(saleId);
    if (!sale) throw new Error('Venda não encontrada para estorno.');
    if (sale.status === 'canceled') throw new Error('Esta venda já foi estornada anteriormente.');

    sale.status = 'canceled';
    sale.canceled_at = now;
    sale.cancel_reason = reason;
    sale.sync_status = 'pending';
    sale.version += 1;
    await db.sales.put(sale);

    const refund: SaleRefund = {
      id: refundId,
      sale_id: saleId,
      tenant_id: sale.tenant_id,
      store_id: sale.store_id,
      reason,
      amount_cents: sale.total_cents,
      refunded_by_user_id: userId,
      refunded_by_user_name: userName,
      created_at: now
    };
    await db.sale_refunds.put(refund);

    const items = await db.sale_items.where('sale_id').equals(saleId).toArray();
    for (const item of items) {
      const balanceId = `${sale.tenant_id}_${sale.store_id}_${item.product_id}${item.variant_id ? `_${item.variant_id}` : ''}`;
      
      const mov: InventoryMovement = {
        id: generateUUID(),
        tenant_id: sale.tenant_id,
        store_id: sale.store_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        type: 'sale_cancel',
        quantity: item.quantity,
        unit_cost_cents: item.unit_cost_cents,
        reason: `Estorno Venda #${sale.sale_number}: ${reason}`,
        reference_id: saleId,
        user_id: userId,
        user_name: userName,
        created_at: now
      };
      await db.inventory_movements.put(mov);

      const currentBalance = await db.inventory_balances.get(balanceId);
      const prevStock = currentBalance ? currentBalance.current_stock : 0;
      await db.inventory_balances.put({
        id: balanceId,
        tenant_id: sale.tenant_id,
        store_id: sale.store_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        current_stock: prevStock + item.quantity,
        reserved_stock: currentBalance ? currentBalance.reserved_stock : 0,
        last_movement_at: now,
        updated_at: now
      });
    }

    const payments = await db.sale_payments.where('sale_id').equals(saleId).toArray();
    for (const pay of payments) {
      if (pay.payment_method === 'money') {
        const cashMovement: CashMovement = {
          id: generateUUID(),
          cash_session_id: sale.cash_session_id,
          tenant_id: sale.tenant_id,
          store_id: sale.store_id,
          type: 'refund',
          amount_cents: pay.amount_cents,
          payment_method: 'money',
          reason: `Devolução em dinheiro Estorno Venda #${sale.sale_number}`,
          user_id: userId,
          user_name: userName,
          created_at: now
        };
        await db.cash_movements.put(cashMovement);
      }
    }

    await enqueueSyncEvent({
      tenantId: sale.tenant_id,
      storeId: sale.store_id,
      deviceId,
      aggregateId: saleId,
      aggregateType: 'sale',
      operationType: 'SALE_REFUND',
      payload: { refund, sale }
    });

    return refund;
  });
}
