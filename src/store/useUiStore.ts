import { create } from 'zustand';

interface UiState {
  isOnline: boolean;
  isSyncing: boolean;
  syncError: string | null;
  pendingSyncCount: number;
  lastSyncAt: string | null;
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  
  // Ações
  setOnlineStatus: (status: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncError: (message: string | null) => void;
  setPendingSyncCount: (count: number) => void;
  setLastSyncAt: (timestamp: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  syncError: null,
  pendingSyncCount: 0,
  lastSyncAt: null,
  sidebarOpen: false,
  theme: 'dark',

  setOnlineStatus: (status) => set({ isOnline: status }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setSyncError: (message) => set({ syncError: message }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        if (next === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return { theme: next };
    })
}));
