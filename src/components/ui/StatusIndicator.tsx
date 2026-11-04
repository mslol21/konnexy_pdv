import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEMO_TENANT_ID } from '../../lib/db/seed';

export const StatusIndicator: React.FC = () => {
  const { isOnline, isSyncing, pendingSyncCount, lastSyncAt } = useUiStore();
  const currentTenant = useAuthStore(s => s.currentTenant);
  if (currentTenant?.id === DEMO_TENANT_ID) return <div className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300" title="Demonstração local: não sincroniza dados com o servidor">DEMO LOCAL</div>;

  if (!isOnline) {
    return (
      <div 
        className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-semibold"
        title="Operação offline: dados salvos neste dispositivo. Backup remoto será tentado ao reconectar."
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span>OFFLINE</span>
        {pendingSyncCount > 0 && (
          <span className="bg-amber-500/30 px-1.5 py-0.2 rounded-full text-[10px]">
            {pendingSyncCount} pendente{pendingSyncCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-full text-xs font-semibold">
        <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        <span>Sincronizando...</span>
      </div>
    );
  }

  if (pendingSyncCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-semibold">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span>{pendingSyncCount} local{pendingSyncCount > 1 ? 'is' : ''} sem backup</span>
      </div>
    );
  }

  if (!lastSyncAt) return <div className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">Sem sincronização remota</div>;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-semibold">
      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
      <span className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" /> Backup dos eventos confirmado
      </span>
    </div>
  );
};
