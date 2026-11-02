import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { seedDemoData, DEMO_TENANT_ID, DEMO_STORE_ID, DEMO_DEVICE_ID } from '../lib/db/seed';
import { enqueueSyncEvent, getPendingSyncCount } from '../lib/sync/outbox';
import { SyncEngine } from '../lib/sync/syncEngine';

describe('FASE 4: Sincronização e Idempotência do Outbox Engine', () => {
  beforeEach(async () => {
    await seedDemoData(true);
  });

  it('deve sincronizar lote de eventos pendentes e atualizar status para synced', async () => {
    // 1. Enfileira 3 eventos
    await enqueueSyncEvent({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      aggregateId: 'agg-01',
      aggregateType: 'sale',
      operationType: 'SALE_CREATE',
      payload: { test: 1 }
    });
    await enqueueSyncEvent({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      aggregateId: 'agg-02',
      aggregateType: 'sale',
      operationType: 'SALE_CREATE',
      payload: { test: 2 }
    });
    await enqueueSyncEvent({
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      aggregateId: 'agg-03',
      aggregateType: 'cash_movement',
      operationType: 'CASH_MOVEMENT',
      payload: { test: 3 }
    });

    const pendingBefore = await getPendingSyncCount(DEMO_TENANT_ID, DEMO_STORE_ID);
    expect(pendingBefore).toBe(3);

    // 2. Executa a sincronização do lote
    const engine = new SyncEngine({ batchSize: 10 });
    const result = await engine.syncBatch(DEMO_TENANT_ID, DEMO_STORE_ID);

    expect(result.success).toBe(true);
    expect(result.processed).toBe(3);

    // 3. Verifica que os eventos agora têm status 'synced'
    const pendingAfter = await getPendingSyncCount(DEMO_TENANT_ID, DEMO_STORE_ID);
    expect(pendingAfter).toBe(0);

    const syncedEvents = await db.sync_events
      .where('[tenant_id+store_id]')
      .equals([DEMO_TENANT_ID, DEMO_STORE_ID])
      .and((e) => e.sync_status === 'synced')
      .toArray();

    expect(syncedEvents.length).toBeGreaterThanOrEqual(3);
    expect(syncedEvents[0].synced_at).toBeDefined();

    // 4. Prova de zero duplicação ao rodar o lote novamente
    const reSyncResult = await engine.syncBatch(DEMO_TENANT_ID, DEMO_STORE_ID);
    expect(reSyncResult.processed).toBe(0);
  });
});
