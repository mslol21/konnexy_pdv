import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole, Tenant, Store } from '../types/database';
import { db } from '../lib/db';
import { getOrCreateDeviceId } from '../lib/utils/id';

interface AuthState {
  currentUser: UserRole | null;
  currentTenant: Tenant | null;
  currentStore: Store | null;
  deviceId: string;
  isAuthenticated: boolean;
  isPinLocked: boolean;
  
  // Ações
  setSession: (user: UserRole, tenant: Tenant, store: Store) => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockSession: () => void;
  logout: () => void;
  switchStore: (store: Store) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      currentTenant: null,
      currentStore: null,
      deviceId: getOrCreateDeviceId(),
      isAuthenticated: false,
      isPinLocked: false,

      setSession: (user, tenant, store) => {
        set({
          currentUser: user,
          currentTenant: tenant,
          currentStore: store,
          isAuthenticated: true,
          isPinLocked: false
        });
      },

      unlockWithPin: async (pin: string) => {
        const { currentTenant } = get();
        if (!currentTenant) return false;

        // Procura usuário no banco local pelo PIN
        const user = await db.user_roles
          .where('tenant_id')
          .equals(currentTenant.id)
          .and((u) => u.pin_hash === pin && u.is_active)
          .first();

        if (user) {
          set({
            currentUser: user,
            isAuthenticated: true,
            isPinLocked: false
          });
          return true;
        }
        return false;
      },

      lockSession: () => {
        set({ isPinLocked: true });
      },

      logout: () => {
        set({
          currentUser: null,
          currentTenant: null,
          currentStore: null,
          isAuthenticated: false,
          isPinLocked: false
        });
      },

      switchStore: (store: Store) => {
        set({ currentStore: store });
      }
    }),
    {
      name: 'konnexy_auth_storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentTenant: state.currentTenant,
        currentStore: state.currentStore,
        deviceId: state.deviceId,
        isAuthenticated: state.isAuthenticated,
        isPinLocked: state.isPinLocked
      })
    }
  )
);
