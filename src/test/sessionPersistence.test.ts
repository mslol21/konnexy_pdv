import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';
import type { UserRole, Tenant, Store } from '../types/database';

describe('Sessão e Persistência de Autenticação (F5/Reload)', () => {
  const now = new Date().toISOString();

  const fakeTenant: Tenant = {
    id: 'tenant-enterprise-real-001',
    name: 'Empresa do Cliente Real Ltda',
    document: '12.345.678/0001-99',
    plan: 'pro',
    created_at: now,
    updated_at: now
  };

  const fakeStore: Store = {
    id: 'store-real-001',
    tenant_id: fakeTenant.id,
    name: 'Loja Centro',
    code: 'LJ01',
    created_at: now,
    updated_at: now
  };

  const fakeUser: UserRole = {
    id: 'user-role-001',
    user_id: 'auth-user-001',
    tenant_id: fakeTenant.id,
    store_id: fakeStore.id,
    name: 'Roberto Administrador',
    email: 'roberto@empresa.com.br',
    role: 'owner',
    pin_hash: '1234',
    is_active: true,
    created_at: now,
    updated_at: now
  };

  beforeEach(() => {
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  it('deve autenticar conta empresarial real e persistir no storage sem reverter para false', () => {
    // 1. Usuário faz login
    useAuthStore.getState().setSession(fakeUser, fakeTenant, fakeStore);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.currentUser?.name).toBe('Roberto Administrador');
    expect(state.currentTenant?.id).toBe('tenant-enterprise-real-001');

    // 2. Simula o que o middleware persist gravou no localStorage
    const savedRaw = localStorage.getItem('konnexy_auth_storage');
    expect(savedRaw).toBeTruthy();
    
    const parsed = JSON.parse(savedRaw!);
    // CRÍTICO: isAuthenticated deve ser TRUE mesmo não sendo DEMO_TENANT_ID!
    expect(parsed.state.isAuthenticated).toBe(true);
    expect(parsed.state.currentUser.id).toBe('user-role-001');
    expect(parsed.state.currentTenant.id).toBe('tenant-enterprise-real-001');
    expect(parsed.state.currentStore.id).toBe('store-real-001');
  });

  it('deve manter sessão ativa e estado não bloqueado após recarregar dados do storage', () => {
    // Simula estado no localStorage antes do reload
    localStorage.setItem(
      'konnexy_auth_storage',
      JSON.stringify({
        state: {
          currentUser: fakeUser,
          currentTenant: fakeTenant,
          currentStore: fakeStore,
          deviceId: 'dev-persistent-01',
          isAuthenticated: true,
          isPinLocked: false
        },
        version: 0
      })
    );

    // Força reidratação do Zustand
    useAuthStore.persist.rehydrate();

    const rehydrated = useAuthStore.getState();
    expect(rehydrated.isAuthenticated).toBe(true);
    expect(rehydrated.isPinLocked).toBe(false);
    expect(rehydrated.currentUser?.id).toBe(fakeUser.id);
    expect(rehydrated.currentTenant?.id).toBe(fakeTenant.id);
  });

  it('limpa storage e tokens ao realizar logout voluntário', () => {
    sessionStorage.setItem('konnexy_access_token', 'test_token_123');
    useAuthStore.getState().setSession(fakeUser, fakeTenant, fakeStore);

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.currentUser).toBeNull();
    expect(sessionStorage.getItem('konnexy_access_token')).toBeNull();
  });
});
