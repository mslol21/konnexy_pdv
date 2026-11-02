import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole, Tenant, Store } from '../types/database';
import { db } from '../lib/db';
import { verifyOperatorPin } from '../lib/security/operatorPin';
import { getOrCreateDeviceId } from '../lib/utils/id';

interface AuthState {
  currentUser: UserRole | null;
  currentTenant: Tenant | null;
  currentStore: Store | null;
  deviceId: string;
  isAuthenticated: boolean;
  isPinLocked: boolean;
  pinFailures: number;
  pinBlockedUntil: number;
  
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
      isPinLocked: true,
      pinFailures: 0,
      pinBlockedUntil: 0,

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
        const { currentTenant, pinBlockedUntil, pinFailures } = get();
        if (!currentTenant || Date.now() < pinBlockedUntil) return false;

        // Procura usuário no banco local pelo PIN
        const candidates = await db.user_roles.where('tenant_id').equals(currentTenant.id).and(u => u.is_active).toArray();
        let user = null;
        for (const candidate of candidates) {
          if (await verifyOperatorPin(pin, candidate.pin_hash)) { user = candidate; break; }
        }

        if (user) {
          set({
            currentUser: user,
            pinFailures: 0,
            pinBlockedUntil: 0,
            isAuthenticated: true,
            isPinLocked: false
          });
          return true;
        }
        const failures = pinFailures + 1;
        set({ pinFailures: failures, pinBlockedUntil: failures >= 5 ? Date.now() + 300000 : 0 });
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
        isAuthenticated: false,
        isPinLocked: true
      })
    }
  )
);
