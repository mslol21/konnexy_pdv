import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from '../OfflineBanner';
import { PinUnlockModal } from '../PinUnlockModal';
import { useUiStore } from '../../store/useUiStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getPendingSyncCount } from '../../lib/sync/outbox';

export const AppLayout: React.FC = () => {
  const { setOnlineStatus, setPendingSyncCount } = useUiStore();
  const { currentTenant, currentStore } = useAuthStore();

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
