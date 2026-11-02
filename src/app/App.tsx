import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes';
import { seedDemoData, isDatabaseInitialized } from '../lib/db/seed';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: false
    }
  }
});

export const App: React.FC = () => {
  useEffect(() => {
    // Garante que o banco IndexedDB local inicialize os dados demonstrativos no primeiro acesso
    async function initializeLocalData() {
      try {
        const initialized = await isDatabaseInitialized();
        if (!initialized) {
          console.info('[Konnexy PDV] Inicializando banco de dados local com catálogo demonstrativo...');
          await seedDemoData();
        }
      } catch (err) {
        console.error('[Konnexy PDV] Falha na inicialização do IndexedDB:', err);
      }
    }
    initializeLocalData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
};
