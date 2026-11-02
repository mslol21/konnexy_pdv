import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { db } from '../../lib/db';
import { seedDemoData, isDatabaseInitialized } from '../../lib/db/seed';
import { useAuthStore } from '../../store/useAuthStore';
import type { UserRole, Tenant, Store as StoreType } from '../../types/database';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [store, setStore] = useState<StoreType | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRole | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const initialized = await isDatabaseInitialized();
        if (!initialized) {
          await seedDemoData();
        }

        const t = await db.tenants.toCollection().first();
        const s = await db.stores.toCollection().first();
        const u = await db.user_roles.toArray();

        setTenant(t || null);
        setStore(s || null);
        setUsers(u);
        if (u.length > 0) {
          setSelectedUser(u[0]);
        }
      } catch (err) {
        console.error('Falha ao inicializar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleLogin = (userToLogin: UserRole) => {
    if (!tenant || !store) return;
    setSession(userToLogin, tenant, store);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
          <span>Inicializando banco de dados local...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-600 mx-auto flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-emerald-950/50 mb-3">
          K
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight">Konnexy PDV</h2>
        <p className="mt-1 text-sm text-slate-400">
          Terminal de Vendas & Gestão Local Offline-First
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-xl rounded-2xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Store className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white">{store?.name || 'Loja Principal'}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {tenant?.name} • CNPJ: {tenant?.document}
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Selecione o Operador para Entrar:
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleLogin(u)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                    selectedUser?.id === u.id
                      ? 'bg-emerald-600/10 border-emerald-500/50 text-white'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-emerald-400">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{u.name}</p>
                      <p className="text-xs text-slate-400">
                        {u.role === 'owner' ? 'Proprietário (Acesso Total)' : 'Operador de Caixa'} • PIN: {u.pin_hash}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/50 flex items-start gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Este dispositivo armazena seus dados em IndexedDB seguro e funciona 100% sem conexão com a internet.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
