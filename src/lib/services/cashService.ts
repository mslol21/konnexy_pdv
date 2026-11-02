import { db } from '../db';
import type { CashSession, CashMovement, PaymentMethod } from '../../types/database';
import { generateUUID } from '../utils/id';
import { getISOTimestamp } from '../utils/date';
import { enqueueSyncEvent } from '../sync/outbox';

export interface OpenCashParams {
  tenantId: string;
  storeId: string;
  deviceId: string;
  userId: string;
  userName: string;
  initialAmountCents: number;
  notes?: string;
}

export interface CashMovementParams {
  cashSessionId: string;
  tenantId: string;
  storeId: string;
  deviceId: string;
  userId: string;
  userName: string;
  type: 'supply' | 'bleed';
  amountCents: number;
  paymentMethod?: PaymentMethod;
  reason: string;
}

export interface CloseCashParams {
  cashSessionId: string;
  tenantId: string;
  storeId: string;
  deviceId: string;
  userId: string;
  userName: string;
  finalAmountCents: number;
  notes?: string;
}

export async function openCashSession(params: OpenCashParams): Promise<CashSession> {
  const now = getISOTimestamp();
  const sessionId = generateUUID();

  const existingOpen = await db.cash_sessions
    .where('[tenant_id+store_id]')
    .equals([params.tenantId, params.storeId])
    .and((s) => s.status === 'open' && s.device_id === params.deviceId)
    .first();

  if (existingOpen) {
    throw new Error('Já existe uma sessão de caixa aberta para este terminal.');
  }

  const session: CashSession = {
    id: sessionId,
    tenant_id: params.tenantId,
    store_id: params.storeId,
    device_id: params.deviceId,
    opened_by_user_id: params.userId,
    opened_by_user_name: params.userName,
    initial_amount_cents: params.initialAmountCents,
    opened_at: now,
    status: 'open',
    notes: params.notes
  };

  const initialMovement: CashMovement = {
    id: generateUUID(),
    cash_session_id: sessionId,
    tenant_id: params.tenantId,
    store_id: params.storeId,
    type: 'opening',
    amount_cents: params.initialAmountCents,
    payment_method: 'money',
    reason: 'Fundo de troco inicial de abertura',
    user_id: params.userId,
    user_name: params.userName,
    created_at: now
  };

  await db.transaction('rw', [db.cash_sessions, db.cash_movements, db.sync_events], async () => {
    await db.cash_sessions.put(session);
    await db.cash_movements.put(initialMovement);

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId,
      deviceId: params.deviceId,
      aggregateId: sessionId,
      aggregateType: 'cash_session',
      operationType: 'CASH_OPEN',
      payload: { session, initialMovement }
    });
  });

  return session;
}

export async function addCashMovement(params: CashMovementParams): Promise<CashMovement> {
  const now = getISOTimestamp();
  const movementId = generateUUID();

  const movement: CashMovement = {
    id: movementId,
    cash_session_id: params.cashSessionId,
    tenant_id: params.tenantId,
    store_id: params.storeId,
    type: params.type,
    amount_cents: params.amountCents,
    payment_method: params.paymentMethod || 'money',
    reason: params.reason,
    user_id: params.userId,
    user_name: params.userName,
    created_at: now
  };

  await db.transaction('rw', [db.cash_movements, db.sync_events], async () => {
    await db.cash_movements.put(movement);

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId,
      deviceId: params.deviceId,
      aggregateId: movementId,
      aggregateType: 'cash_movement',
      operationType: 'CASH_MOVEMENT',
      payload: { movement }
    });
  });

  return movement;
}

export async function closeCashSession(params: CloseCashParams): Promise<CashSession> {
  const now = getISOTimestamp();

  return await db.transaction('rw', [db.cash_sessions, db.cash_movements, db.sync_events], async () => {
    const session = await db.cash_sessions.get(params.cashSessionId);
    if (!session || session.status === 'closed') {
      throw new Error('Sessão de caixa não encontrada ou já encerrada.');
    }

    const movements = await db.cash_movements
      .where('cash_session_id')
      .equals(params.cashSessionId)
      .toArray();

    const movementsCashSum = movements.reduce((acc, m) => {
      if (m.payment_method === 'money') {
        if (m.type === 'supply' || m.type === 'sale') return acc + m.amount_cents;
        if (m.type === 'bleed' || m.type === 'refund') return acc - m.amount_cents;
      }
      return acc;
    }, 0);

    const expectedAmount = session.initial_amount_cents + movementsCashSum;
    const difference = params.finalAmountCents - expectedAmount;

    session.closed_by_user_id = params.userId;
    session.closed_by_user_name = params.userName;
    session.final_amount_cents = params.finalAmountCents;
    session.expected_amount_cents = expectedAmount;
    session.difference_cents = difference;
    session.closed_at = now;
    session.status = 'closed';
    if (params.notes) {
      session.notes = session.notes ? `${session.notes} | Fechamento: ${params.notes}` : params.notes;
    }

    await db.cash_sessions.put(session);

    const closingMovement: CashMovement = {
      id: generateUUID(),
      cash_session_id: params.cashSessionId,
      tenant_id: params.tenantId,
      store_id: params.storeId,
      type: 'closing',
      amount_cents: params.finalAmountCents,
      payment_method: 'money',
      reason: `Fechamento de caixa. Esperado: ${expectedAmount}, Declarado: ${params.finalAmountCents}, Dif: ${difference}`,
      user_id: params.userId,
      user_name: params.userName,
      created_at: now
    };

    await db.cash_movements.put(closingMovement);

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId,
      deviceId: params.deviceId,
      aggregateId: session.id,
      aggregateType: 'cash_session',
      operationType: 'CASH_CLOSE',
      payload: { session, closingMovement }
    });

    return session;
  });
}

export async function getActiveCashSession(
  tenantId: string, 
  storeId: string, 
  deviceId: string
): Promise<CashSession | null> {
  const session = await db.cash_sessions
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((s) => s.status === 'open' && s.device_id === deviceId)
    .first();

  return session || null;
}
