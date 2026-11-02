import { db } from '../db';
import { DEMO_TENANT_ID } from '../db/seed';
import { updateEventsSyncStatus } from './outbox';
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
    this.intervalMs = config.intervalMs || 15000;
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
      // 1. Obtém eventos pendentes ou que falharam com retry < maxRetries
      const pendingEvents = await db.sync_events
        .where('[tenant_id+store_id]')
        .equals([tenantId, storeId])
        .and((e) => e.sync_status === 'pending' || (e.sync_status === 'failed' && e.retry_count < this.maxRetries))
        .limit(this.batchSize)
        .toArray();

      if (pendingEvents.length === 0) {
        uiStore.setPendingSyncCount(0);
        return { processed: 0, success: true };
      }

      // 2. Simula envio idempotente ao endpoint remoto (Supabase RPC process_sync_batch)
      const confirmedIds = await this.dispatchToServer(pendingEvents);

      // 3. Atualiza o status dos eventos confirmados para 'synced'
      await updateEventsSyncStatus(confirmedIds, 'synced');

      // 4. Atualiza métricas na UI
      const remainingCount = await db.sync_events
        .where('[tenant_id+store_id]')
        .equals([tenantId, storeId])
        .and((e) => e.sync_status === 'pending')
        .count();

      uiStore.setPendingSyncCount(remainingCount);
      if (confirmedIds.length > 0) uiStore.setLastSyncAt(new Date().toISOString());

      return { processed: confirmedIds.length, success: true };
    } catch (err: unknown) {
      console.warn('[SyncEngine] Falha ao despachar lote de eventos:', err);
      return { processed: 0, success: false };
    } finally {
      this.isRunning = false;
      uiStore.setSyncing(false);
    }
  }

  /**
   * Comunicação com o servidor / Supabase com garantia de idempotência.
   * Se configurado com credenciais Supabase reais, envia via REST/RPC; caso contrário,
   * valida integridade e confirma os IDs localmente garantindo teste offline autônomo.
   */
  private async dispatchToServer(events: SyncEvent[]): Promise<string[]> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const accessToken = sessionStorage.getItem('konnexy_access_token');

    if (supabaseUrl && supabaseKey && accessToken && !supabaseUrl.includes('seu-projeto')) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/process_sync_batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            p_device_id: events[0]?.device_id || 'dev-unknown',
            p_events: events
          })
        });

        if (!response.ok) {
          throw new Error(`Servidor retornou HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data.confirmed_event_ids)) throw new Error('Resposta de sincronização inválida');
        return data.confirmed_event_ids.filter((id: unknown): id is string => typeof id === 'string' && events.some(e => e.event_id === id));
      } catch (networkErr) {
        // Incrementa retries em caso de falha de conexão real
        const eventIds = events.map((e) => e.event_id);
        await updateEventsSyncStatus(eventIds, 'failed', String(networkErr));
        throw networkErr;
      }
    }

    // Nunca confirmar eventos localmente sem persistência remota.
    throw new Error('Sincronização indisponível: configuração ou sessão ausente');
  }
}

export const syncEngine = new SyncEngine();
