import React, { useState } from 'react';
import { Menu, User, Store as StoreIcon, Lock, Moon, Sun, Download, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUiStore } from '../../store/useUiStore';
import { StatusIndicator } from '../ui/StatusIndicator';
import { usePwaInstall } from '../../lib/hooks/usePwaInstall';
import { DEMO_TENANT_ID } from '../../lib/db/seed';
import { syncEngine } from '../../lib/sync/syncEngine';
import { getPendingSyncCount } from '../../lib/sync/outbox';

export const Header: React.FC = () => {
  const { currentUser, currentStore, currentTenant, lockSession } = useAuthStore();
  const { isSyncing, isOnline, setPendingSyncCount } = useUiStore();
  const [syncMessage, setSyncMessage] = useState('');
  const isDemo = currentTenant?.id === DEMO_TENANT_ID;

  const handleManualSync = async () => {
    if (!currentTenant || !currentStore || isDemo || isSyncing) return;
    setSyncMessage('');
    if (!isOnline) { setSyncMessage('Sem internet. Os eventos permanecem salvos neste dispositivo.'); return; }
    if (!sessionStorage.getItem('konnexy_access_token')) { setSyncMessage('Sessão empresarial ausente. Saia e entre novamente com e-mail e senha.'); return; }
    const result = await syncEngine.syncBatch(currentTenant.id, currentStore.id);
    const remaining = await getPendingSyncCount(currentTenant.id, currentStore.id);
    setPendingSyncCount(remaining);
    const error = useUiStore.getState().syncError;
    setSyncMessage(error || (result.success ? (remaining === 0 ? 'Backup dos eventos confirmado. Dados operacionais ainda exigem sincronização própria.' : `${result.processed} evento(s) enviados; ${remaining} ainda pendente(s).`) : 'Não foi possível confirmar o backup. Tente novamente.'));
  };
  const { toggleSidebar, theme, toggleTheme } = useUiStore();
  const { isInstalled, isInstallable, isIOS, installApp } = usePwaInstall();

  const handleInstallClick = async () => {
    if (isInstallable) {
      await installApp();
    } else if (isIOS) {
      alert('Para instalar no iOS (iPhone/iPad):\n1. Toque no ícone Compartilhar (quadrado com seta)\n2. Role para baixo e selecione "Adicionar à Tela de Início"');
    } else {
      alert('Para instalar no seu computador ou celular:\nClique no ícone de instalação na barra de endereços do navegador (ou vá em Menu > Instalar Konnexy PDV).');
    }
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Alternar Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-base shadow-sm">
            K
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight flex items-center gap-2">
              Konnexy PDV
              <span className="text-[10px] font-normal text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded">
                v0.1.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <StoreIcon className="w-3 h-3 text-emerald-400 inline" />
              <span>{currentStore?.name || 'Loja Matriz'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {!isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all cursor-pointer min-h-[44px]"
            title="Instalar aplicativo para uso offline nativo"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Instalar App</span>
          </button>
        )}

        <StatusIndicator />
        {!isDemo && <button type="button" onClick={() => void handleManualSync()} disabled={isSyncing} className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50 sm:px-3" title="Enviar eventos locais para backup no Supabase (não atualiza automaticamente as tabelas operacionais)" aria-label="Sincronizar eventos com Supabase"><RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Enviar ao Supabase</span><span className="sm:hidden">Enviar</span></button>}
        {syncMessage && !isDemo && <div role="status" aria-live="polite" className="absolute right-2 top-16 z-50 max-w-sm rounded-lg border border-slate-600 bg-slate-950 p-3 text-xs text-slate-100 shadow-xl"><p>{syncMessage}</p><button type="button" className="mt-2 text-emerald-300 underline" onClick={() => setSyncMessage('')}>Fechar</button></div>}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
          title="Alternar Tema Claro/Escuro"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
        </button>

        <button
          onClick={lockSession}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
          title="Bloquear Terminal (Requer PIN para desbloquear)"
        >
          <Lock className="w-4 h-4 text-slate-300" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-white truncate max-w-[120px]">
              {currentUser?.name || 'Operador'}
            </p>
            <p className="text-[10px] text-emerald-400 uppercase font-medium">
              {currentUser?.role === 'owner' ? 'Proprietário' : currentUser?.role === 'cashier' ? 'Caixa' : 'Operador'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
