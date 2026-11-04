import React, { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from '../OfflineBanner';
import { PinUnlockModal } from '../PinUnlockModal';
import { useUiStore } from '../../store/useUiStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getPendingSyncCount } from '../../lib/sync/outbox';
import { syncEngine } from '../../lib/sync/syncEngine';
import { DEMO_TENANT_ID } from '../../lib/db/seed';

export const AppLayout: React.FC = () => {
  const { setOnlineStatus, setPendingSyncCount } = useUiStore();
  const { currentTenant, currentStore, logout } = useAuthStore();
  const isDemo = currentTenant?.id === DEMO_TENANT_ID;

  useEffect(() => {
    if (!currentTenant || !currentStore || currentTenant.id === DEMO_TENANT_ID) return;
    const run = () => { void syncEngine.syncBatch(currentTenant.id, currentStore.id); };
    run();
    syncEngine.start(currentTenant.id, currentStore.id);
    window.addEventListener('online', run);
    return () => { syncEngine.stop(); window.removeEventListener('online', run); };
  }, [currentTenant?.id, currentStore?.id]);

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Atualiza contagem de pendências a cada 10 segundos
    const checkPending = async () => {
      if (currentTenant && currentStore) {
        try {
          const count = await getPendingSyncCount(currentTenant.id, currentStore.id);
          setPendingSyncCount(count);
        } catch {
          // Erro silencioso em caso de DB inicializando
        }
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [currentTenant, currentStore, setOnlineStatus, setPendingSyncCount]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <OfflineBanner />
      {isDemo && <div className="flex flex-wrap items-center justify-center gap-2 border-b border-sky-700/40 bg-sky-950 px-4 py-2 text-center text-xs text-sky-200" role="status"><strong>AMBIENTE DE DEMONSTRAÇÃO</strong><span>Os dados desta conta são fictícios, ficam somente neste navegador e não são enviados ao Supabase.</span><Link to="/login" onClick={logout} className="font-bold text-white underline underline-offset-2">Entrar com conta empresarial</Link></div>}
      <Header />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-6 p-4 sm:p-6 bg-slate-900/50">
          <Outlet />
        </main>
      </div>

      <BottomNav />
      <PinUnlockModal />
    </div>
  );
};
