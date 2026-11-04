import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole, Tenant, Store } from '../types/database';
import { db } from '../lib/db';
import { verifyOperatorPin } from '../lib/security/operatorPin';
import { DEMO_TENANT_ID } from '../lib/db/seed';
import { getOrCreateDeviceId } from '../lib/utils/id';

interface AuthState {
  hasHydrated: boolean;
  currentUser: UserRole | null;
  currentTenant: Tenant | null;
  currentStore: Store | null;
  deviceId: string;
  isAuthenticated: boolean;
  isPinLocked: boolean;
  pinFailures: number;
  pinBlockedUntil: number;
  
  // Ações
  setHasHydrated: (val: boolean) => void;
  setSession: (user: UserRole, tenant: Tenant, store: Store) => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockSession: () => void;
  lockSession: () => void;
  logout: () => void;
  switchStore: (store: Store) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      currentUser: null,
      currentTenant: null,
      currentStore: null,
      deviceId: getOrCreateDeviceId(),
      isAuthenticated: false,
      isPinLocked: false,
      pinFailures: 0,
      pinBlockedUntil: 0,

      setHasHydrated: (val: boolean) => set({ hasHydrated: val }),

      setSession: (user, tenant, store) => {
        set({
          currentUser: user,
          currentTenant: tenant,
          currentStore: store,
          isAuthenticated: true,
          isPinLocked: false,
          pinFailures: 0,
          pinBlockedUntil: 0
        });
      },

      unlockWithPin: async (pin: string) => {
        const { currentTenant, currentUser, pinBlockedUntil, pinFailures } = get();
        if (!currentTenant || Date.now() < pinBlockedUntil) return false;

        // Se o operador atual não tem PIN configurado, desbloqueia diretamente
        if (!currentUser?.pin_hash) {
          set({
            isPinLocked: false,
            pinFailures: 0,
            pinBlockedUntil: 0
          });
          return true;
        }

        // Procura usuário no banco local pelo PIN
        const candidates = await db.user_roles.where('tenant_id').equals(currentTenant.id).and(u => u.is_active).toArray();
        let user: UserRole | null = null;
        for (const candidate of candidates) {
          if (
            (currentTenant.id === DEMO_TENANT_ID && candidate.pin_hash === pin) ||
            candidate.pin_hash === pin ||
            await verifyOperatorPin(pin, candidate.pin_hash)
          ) {
            user = candidate;
            break;
          }
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

      unlockSession: () => {
        set({ isPinLocked: false, pinFailures: 0, pinBlockedUntil: 0 });
      },

      lockSession: () => {
        set({ isPinLocked: true });
      },

      logout: () => {
        try {
          sessionStorage.removeItem('konnexy_access_token');
        } catch {
          // ignore
        }
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
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentTenant: state.currentTenant,
        currentStore: state.currentStore,
        deviceId: state.deviceId,
        isAuthenticated: Boolean(state.isAuthenticated && state.currentUser && state.currentTenant && state.currentStore),
        isPinLocked: Boolean(state.isPinLocked && state.currentUser?.pin_hash)
      })
    }
  )
);
