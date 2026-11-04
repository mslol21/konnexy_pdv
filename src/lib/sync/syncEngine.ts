import { db } from '../db';
import { DEMO_TENANT_ID } from '../db/seed';
import { updateEventsSyncStatus, getPendingSyncCount } from './outbox';
import { useUiStore } from '../../store/useUiStore';
import type { SyncEvent } from '../../types/database';

export interface SyncEngineConfig {
  batchSize?: number;
  intervalMs?: number;
  maxRetries?: number;
}

export class SyncEngine {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private batchSize: number;
  private intervalMs: number;
  private maxRetries: number;

  constructor(config: SyncEngineConfig = {}) {
    this.batchSize = config.batchSize || 20;
    this.intervalMs = config.intervalMs || 60000;
    this.maxRetries = config.maxRetries || 5;
  }

  /**
   * Inicia o loop de sincronização em segundo plano.
   */
  public start(tenantId: string, storeId: string): void {
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return; // Não executa se estiver sabidamente offline
      }
      await this.syncBatch(tenantId, storeId);
    }, this.intervalMs);
  }

  /**
   * Para o loop de sincronização.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Processa um lote de eventos da fila Outbox.
   */
  public async syncBatch(tenantId: string, storeId: string): Promise<{
    processed: number;
    success: boolean;
  }> {
    if (tenantId === DEMO_TENANT_ID) return { processed: 0, success: true }; // Demo nunca envia dados fictícios ao Supabase.
    if (this.isRunning) return { processed: 0, success: false };
    this.isRunning = true;

    const uiStore = useUiStore.getState();
    uiStore.setSyncing(true);

    try {
      // 1. Recupera todos os eventos sem confirmação, inclusive falhas antigas (sem perda de dados)
      const pendingEvents = await db.sync_events
        .where('[tenant_id+store_id]')
        .equals([tenantId, storeId])
        .and((e) => e.sync_status !== 'synced')
        .limit(this.batchSize)
        .toArray();

      if (pendingEvents.length === 0) {
        uiStore.setPendingSyncCount(await getPendingSyncCount(tenantId, storeId));
        return { processed: 0, success: true };
      }

      // 2. Grava eventos em backup remoto com isolamento RLS e verificação de IDs
      const confirmedIds = await this.dispatchToServer(pendingEvents);

      // 3. Atualiza o status dos eventos confirmados para 'synced'
      await updateEventsSyncStatus(confirmedIds, 'synced');

      // 4. Atualiza métricas na UI
      const remainingCount = await getPendingSyncCount(tenantId, storeId);

      uiStore.setPendingSyncCount(remainingCount);
      if (confirmedIds.length > 0) uiStore.setLastSyncAt(new Date().toISOString());

      return { processed: confirmedIds.length, success: confirmedIds.length === pendingEvents.length };
    } catch (err: unknown) {
      console.warn('[SyncEngine] Falha ao despachar lote de eventos:', err);
      uiStore.setPendingSyncCount(await getPendingSyncCount(tenantId, storeId));
      return { processed: 0, success: false };
    } finally {
      this.isRunning = false;
      uiStore.setSyncing(false);
    }
  }

  /**
   * Backup idempotente de eventos no Supabase, protegido por RLS.
   * A confirmação significa somente que o evento foi armazenado na nuvem;
   * NÃO significa que vendas/estoque/caixa foram materializados nas tabelas operacionais.
   */
  private async dispatchToServer(events: SyncEvent[]): Promise<string[]> {
    const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const token = sessionStorage.getItem('konnexy_access_token');
    if (!url || !key || !token) throw new Error('Entre novamente na conta empresarial para enviar o backup.');
    const headers = { apikey: key, Authorization: `Bearer ${token}` };
    const records = events.map(({ event_id, tenant_id, store_id, device_id, aggregate_id, aggregate_type, aggregate_version, operation_type, payload, created_at }) => ({
      event_id, tenant_id, store_id, device_id, aggregate_id, aggregate_type,
      aggregate_version, operation_type, payload, created_at
    }));
    const response = await fetch(`${url}/rest/v1/sync_events?on_conflict=event_id`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(records)
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Backup remoto recusado (HTTP ${response.status}): ${detail.slice(0, 220)}`);
    }
    // Uma resposta 2xx sozinha não prova que todos os registros foram inseridos:
    // confirma cada ID por leitura RLS, inclusive os já existentes (idempotência).
    const ids = events.map(e => e.event_id);
    const filter = ids.map(encodeURIComponent).join(',');
    const verification = await fetch(`${url}/rest/v1/sync_events?select=event_id,tenant_id,store_id&event_id=in.(${filter})`, { headers });
    if (!verification.ok) throw new Error(`Falha ao verificar backup (HTTP ${verification.status})`);
    const remote = await verification.json() as Array<{event_id:string;tenant_id:string;store_id:string}>;
    return events.filter(e => remote.some(row => row.event_id === e.event_id && row.tenant_id === e.tenant_id && row.store_id === e.store_id)).map(e => e.event_id);
  }
}

export const syncEngine = new SyncEngine();
