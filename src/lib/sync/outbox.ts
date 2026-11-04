import { db } from '../db';
import type { SyncEvent, OperationType, SyncStatus } from '../../types/database';
import { generateUUID } from '../utils/id';
import { getISOTimestamp } from '../utils/date';

export interface CreateSyncEventParams {
  tenantId: string;
  storeId: string;
  deviceId: string;
  aggregateId: string;
  aggregateType: string;
  aggregateVersion?: number;
  operationType: OperationType;
  payload: Record<string, unknown>;
}

export async function enqueueSyncEvent(params: CreateSyncEventParams): Promise<SyncEvent> {
  const event: SyncEvent = {
    event_id: generateUUID(),
    tenant_id: params.tenantId,
    store_id: params.storeId,
    device_id: params.deviceId,
    aggregate_id: params.aggregateId,
    aggregate_type: params.aggregateType,
    aggregate_version: params.aggregateVersion ?? 1,
    operation_type: params.operationType,
    payload: params.payload,
    created_at: getISOTimestamp(),
    sync_status: 'pending',
    retry_count: 0
  };

  await db.sync_events.put(event);
  return event;
}

export async function getPendingSyncCount(tenantId: string, storeId: string): Promise<number> {
  return await db.sync_events
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((e) => e.sync_status !== 'synced')
    .count();
}

export async function updateEventsSyncStatus(
  eventIds: string[], 
  status: SyncStatus, 
  errorMessage?: string
): Promise<void> {
  const now = getISOTimestamp();
  await db.transaction('rw', db.sync_events, async () => {
    for (const eventId of eventIds) {
      const event = await db.sync_events.where('event_id').equals(eventId).first();
      if (event) {
        event.sync_status = status;
        if (status === 'synced') {
          event.synced_at = now;
        } else if (status === 'failed') {
          event.retry_count += 1;
          event.error_message = errorMessage;
        }
        await db.sync_events.put(event);
      }
    }
  });
}
