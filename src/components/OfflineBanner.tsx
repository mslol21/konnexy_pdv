import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { useUiStore } from '../store/useUiStore';
import { useAuthStore } from '../store/useAuthStore';
import { seedDemoData } from '../lib/db/seed';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingSyncCount } = useUiStore();
  const { currentTenant } = useAuthStore();
  const [isResetting, setIsResetting] = React.useState(false);

  const isDemo = currentTenant?.id.includes('demo');

  const handleResetDemo = async () => {
    if (confirm('Deseja recarregar o banco de dados com os dados demonstrativos de fábrica?')) {
      setIsResetting(true);
      await seedDemoData(true);
      window.location.reload();
    }
  };

  return (
    <div className="bg-slate-950 border-b border-slate-800 px-3 py-1.5 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {isDemo && (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase">
            Modo Demonstração (Local)
          </span>
        )}
        <span className="hidden sm:inline text-slate-400">
          IndexedDB operacional ativo. Todas as transações são preservadas mesmo sem sinal de rede.
        </span>
      </div>

      <div className="flex items-center gap-3">
        {!isOnline && (
          <span className="text-amber-400 flex items-center gap-1 font-medium">
            <ShieldAlert className="w-3.5 h-3.5" /> Fila Outbox: {pendingSyncCount} registros locais
          </span>
        )}
        {isDemo && (
          <button
            onClick={handleResetDemo}
            disabled={isResetting}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Restaurar dados iniciais da demonstração"
          >
            <RefreshCw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Resetar Dados Demo</span>
          </button>
        )}
      </div>
    </div>
  );
};
