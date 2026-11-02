import { db } from '../db';
import type { InventoryMovement, InventoryBalance, MovementType } from '../../types/database';
import { generateUUID } from '../utils/id';
import { getISOTimestamp } from '../utils/date';
import { enqueueSyncEvent } from '../sync/outbox';

export interface CreateMovementParams {
  tenantId: string;
  storeId: string;
  deviceId: string;
  productId: string;
  variantId?: string | null;
  type: MovementType;
  quantity: number; // Positivo para entrada/ajuste positivo, negativo para saída/venda
  unitCostCents: number;
  reason: string;
  userId: string;
  userName: string;
  referenceId?: string;
}

/**
 * Cria uma movimentação de estoque imutável (append-only) e atualiza a projeção de saldo.
 * NUNCA atualiza a quantidade sem gerar um movimento.
 */
export async function createInventoryMovement(params: CreateMovementParams): Promise<{
  movement: InventoryMovement;
  newBalance: number;
}> {
  const now = getISOTimestamp();
  const movementId = generateUUID();
  const balanceId = `${params.tenantId}_${params.storeId}_${params.productId}${params.variantId ? `_${params.variantId}` : ''}`;

  return await db.transaction('rw', [db.inventory_movements, db.inventory_balances, db.sync_events], async () => {
    // 1. Obtém saldo atual da projeção local
    const currentBalanceRecord = await db.inventory_balances.get(balanceId);
    const prevStock = currentBalanceRecord ? currentBalanceRecord.current_stock : 0;
    const newStock = prevStock + params.quantity;

    // 2. Cria o registro imutável da movimentação
    const movement: InventoryMovement = {
      id: movementId,
      tenant_id: params.tenantId,
      store_id: params.storeId,
      product_id: params.productId,
      variant_id: params.variantId || null,
      type: params.type,
      quantity: params.quantity,
      unit_cost_cents: params.unitCostCents,
      reason: params.reason,
      user_id: params.userId,
      user_name: params.userName,
      reference_id: params.referenceId,
      created_at: now
    };

    await db.inventory_movements.put(movement);

    // 3. Atualiza a projeção de saldo
    const updatedBalance: InventoryBalance = {
      id: balanceId,
      tenant_id: params.tenantId,
      store_id: params.storeId,
      product_id: params.productId,
      variant_id: params.variantId || null,
      current_stock: newStock,
      reserved_stock: currentBalanceRecord ? currentBalanceRecord.reserved_stock : 0,
      last_movement_at: now,
      updated_at: now
    };

    await db.inventory_balances.put(updatedBalance);

    // 4. Enfileira evento de sincronização Outbox
    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId,
      deviceId: params.deviceId,
      aggregateId: movementId,
      aggregateType: 'inventory_movement',
      operationType: 'INVENTORY_ADJUST',
      payload: {
        movement,
        new_balance: newStock
      }
    });

    return { movement, newBalance: newStock };
  });
}

/**
 * Recalcula a projeção de saldo a partir do histórico completo de movimentos.
 */
export async function recalculateInventoryBalance(
  tenantId: string,
  storeId: string,
  productId: string,
  variantId?: string | null
): Promise<number> {
  const movements = await db.inventory_movements
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((m) => m.product_id === productId && (variantId ? m.variant_id === variantId : true))
    .toArray();

  const totalStock = movements.reduce((acc, m) => acc + m.quantity, 0);
  const balanceId = `${tenantId}_${storeId}_${productId}${variantId ? `_${variantId}` : ''}`;
  const now = getISOTimestamp();

  await db.inventory_balances.put({
    id: balanceId,
    tenant_id: tenantId,
    store_id: storeId,
    product_id: productId,
    variant_id: variantId || null,
    current_stock: totalStock,
    reserved_stock: 0,
    last_movement_at: now,
    updated_at: now
  });

  return totalStock;
}

/**
 * Consulta saldo de estoque atual de um produto.
 */
export async function getProductStock(
  tenantId: string,
  storeId: string,
  productId: string,
  variantId?: string | null
): Promise<number> {
  const balanceId = `${tenantId}_${storeId}_${productId}${variantId ? `_${variantId}` : ''}`;
  const record = await db.inventory_balances.get(balanceId);
  return record ? record.current_stock : 0;
}
