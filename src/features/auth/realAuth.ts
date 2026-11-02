import type { Store, Tenant, UserRole } from '../../types/database';
import { db } from '../../lib/db';

type AuthResponse = { access_token?: string; user?: { id: string }; error_description?: string; msg?: string };
const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function config() {
  if (!base || !key) throw new Error('Autenticação não configurada neste ambiente.');
  return { base: base.replace(/\/$/, ''), key };
}

export async function signInRealAccount(email: string, password: string): Promise<{ user: UserRole; tenant: Tenant; store: Store }> {
  const { base: url, key: apiKey } = config();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ email: email.trim(), password })
  });
  const auth = await response.json() as AuthResponse;
  if (!response.ok || !auth.access_token || !auth.user?.id) {
    throw new Error(auth.error_description || auth.msg || 'E-mail ou senha inválidos.');
  }
  const headers = { apikey: apiKey, Authorization: `Bearer ${auth.access_token}` };
  const getRows = async <T>(table: string, filters: string): Promise<T[]> => {
    const result = await fetch(`${url}/rest/v1/${table}?select=*&${filters}`, { headers });
    if (!result.ok) throw new Error(`Não foi possível consultar ${table}. Verifique as permissões da conta (RLS).`);
    return await result.json() as T[];
  };
  try {
    const roles = await getRows<UserRole>('user_roles', `user_id=eq.${encodeURIComponent(auth.user.id)}&is_active=eq.true&limit=1`);
    const user = roles[0];
    if (!user) throw new Error('Conta autenticada, mas sem vínculo ativo com uma empresa. Solicite liberação ao administrador.');
    const tenants = await getRows<Tenant>('tenants', `id=eq.${encodeURIComponent(user.tenant_id)}&limit=1`);
    const stores = await getRows<Store>('stores', `tenant_id=eq.${encodeURIComponent(user.tenant_id)}&limit=100`);
    const tenant = tenants[0];
    const store = stores.find(s => s.id === user.store_id) || stores[0];
    if (!tenant || !store || (tenant as Tenant & {is_active?: boolean}).is_active === false) throw new Error('Empresa suspensa ou loja indisponível para esta conta.');
    await db.transaction('rw', db.tenants, db.stores, db.user_roles, async () => {
      await db.tenants.put(tenant);
      await db.stores.put(store);
      await db.user_roles.put(user);
    });
    sessionStorage.setItem('konnexy_access_token', auth.access_token);
    return { user, tenant, store };
  } catch (error) {
    sessionStorage.removeItem('konnexy_access_token');
    throw error;
  }
}
