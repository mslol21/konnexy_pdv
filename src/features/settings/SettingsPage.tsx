import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Database, 
  Smartphone, 
  HardDriveDownload, 
  RotateCcw, 
  Shield, 
  UserPlus, 
  Users, 
  X 
} from 'lucide-react';
import { db } from '../../lib/db';
import { useAuthStore } from '../../store/useAuthStore';
import { useUiStore } from '../../store/useUiStore';
import { seedDemoData, DEMO_TENANT_ID } from '../../lib/db/seed';
import { createUser } from '../../lib/services/userService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import type { UserRole, RoleName } from '../../types/database';

export const SettingsPage: React.FC = () => {
  const { currentTenant, currentStore, currentUser, deviceId } = useAuthStore();
  const { isOnline } = useUiStore();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [stats, setStats] = useState({
    products: 0,
    sales: 0,
    movements: 0,
    syncEvents: 0
  });
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const isDemo = currentTenant?.id === DEMO_TENANT_ID;
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Modal Novo Operador
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<RoleName>('cashier');
  const [newUserPin, setNewUserPin] = useState('1111');
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [userSubmitting, setUserSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentTenant) return;
    try {
      const [products, sales, movements, syncEvents, userList] = await Promise.all([
        db.products.count(),
        db.sales.count(),
        db.inventory_movements.count(),
        db.sync_events.count(),
        db.user_roles.where('tenant_id').equals(currentTenant.id).toArray()
      ]);
      setStats({ products, sales, movements, syncEvents });
      setUsers(userList);
    } catch (err) {
      console.error('Erro ao ler estatísticas do DB:', err);
    }
  }, [currentTenant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportBackup = async () => {
    try {
      setExporting(true);
      const backupData = {
        exportedAt: new Date().toISOString(),
        tenant: currentTenant,
        store: currentStore,
        deviceId,
        users: await db.user_roles.toArray(),
        products: await db.products.toArray(),
        categories: await db.categories.toArray(),
        sales: await db.sales.toArray(),
        saleItems: await db.sale_items.toArray(),
        salePayments: await db.sale_payments.toArray(),
        inventoryBalances: await db.inventory_balances.toArray(),
        inventoryMovements: await db.inventory_movements.toArray(),
        cashSessions: await db.cash_sessions.toArray(),
        cashMovements: await db.cash_movements.toArray(),
        financialEntries: await db.financial_entries.toArray(),
        customers: await db.customers.toArray(),
        suppliers: await db.suppliers.toArray()
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-konnexy-pdv-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Falha ao exportar backup: ' + err);
    } finally {
      setExporting(false);
    }
  };

  const handleResetDemo = async () => {
    if (confirm('Tem certeza que deseja restaurar o banco de dados para os valores padrão de demonstração? Todas as vendas não sincronizadas serão perdidas.')) {
      setResetting(true);
      await seedDemoData(true);
      window.location.reload();
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    if (newPassword.length < 12) { setPasswordMessage('A nova senha deve ter pelo menos 12 caracteres.'); return; }
    const token = sessionStorage.getItem('konnexy_access_token');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!token || !url || !key) { setPasswordMessage('Faça login novamente para alterar sua senha.'); return; }
    setPasswordBusy(true);
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword })
      });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.msg || body.message || 'Não foi possível atualizar a senha.'); }
      setNewPassword('');
      setPasswordMessage('Senha atualizada. Use a nova senha no próximo acesso.');
    } catch (err) { setPasswordMessage(err instanceof Error ? err.message : 'Falha ao atualizar senha.'); }
    finally { setPasswordBusy(false); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;
    if (!isDemo) { setUserModalError('O cadastro de operadores de empresas reais exige provisionamento no servidor.'); return; }
    setUserModalError(null);

    if (!newUserName.trim()) {
      setUserModalError('Informe o nome do operador.');
      return;
    }
    if (newUserPin.length !== 4) {
      setUserModalError('O PIN deve conter exatamente 4 dígitos.');
      return;
    }

    setUserSubmitting(true);
    try {
      await createUser({
        tenantId: currentTenant.id,
        storeId: currentStore?.id,
        deviceId,
        name: newUserName.trim(),
        email: newUserEmail.trim() || `${newUserName.toLowerCase().replace(/\s+/g, '')}@loja.local`,
        role: newUserRole,
        pin: newUserPin.trim()
      });

      setIsUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPin('1111');
      await loadData();
    } catch (err: unknown) {
      setUserModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setUserSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          Configurações, Usuários & Armazenamento Local
        </h2>
        <p className="text-sm text-slate-400">
          Gerenciamento de operadores, alçadas de acesso, persistência IndexedDB e backup
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Empresa & Estabelecimento
          </h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Empresa:</span>
              <span className="font-semibold text-white">{currentTenant?.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Documento:</span>
              <span className="font-mono">{currentTenant?.document}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Loja Ativa:</span>
              <span className="font-semibold text-emerald-400">{currentStore?.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Código Loja:</span>
              <span className="font-mono">{currentStore?.code}</span>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            Terminal de Ponto de Venda
          </h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">ID Dispositivo:</span>
              <span className="font-mono text-xs text-sky-300">{deviceId}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Operador Atual:</span>
              <span className="font-semibold text-white">{currentUser?.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Papel / Alçada:</span>
              <Badge variant="neutral">{currentUser?.role}</Badge>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Estado de Rede:</span>
              <Badge variant={isOnline ? 'success' : 'warning'}>
                {isOnline ? 'Conectado à Internet' : 'Offline (Modo Local)'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Gestão de Operadores & Usuários (RBAC) */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Operadores & Perfis de Acesso (RBAC)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isDemo ? "Operadores locais da demonstração (PIN de teste)" : "Operadores reais devem ser autorizados pelo administrador no servidor"}
            </p>
          </div>
          <Button
            disabled={!isDemo}
            onClick={() => setIsUserModalOpen(true)}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar Operador</span>
          </Button>
        </div>

        <div className="divide-y divide-slate-800 text-xs">
          {users.map((u) => {
            const roleLabels: Record<string, string> = {
              owner: 'Proprietário (Acesso Total)',
              manager: 'Gerente (Descontos e Cancelamentos)',
              cashier: 'Operador de Caixa (Desconto máx 10%)',
              stockist: 'Estoquista (Movimentações de Estoque)'
            };

            return (
              <div key={u.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-sm flex items-center gap-2">
                    {u.name}
                    {u.id === currentUser?.id && (
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-normal">
                        Você
                      </span>
                    )}
                  </p>
                  <p className="text-slate-400">{u.email} • {roleLabels[u.role] || u.role}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">
                    PIN: {isDemo && /^\d{4}$/.test(u.pin_hash ?? '') ? u.pin_hash : "••••••"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {!isDemo && <Card className="space-y-3">
        <h3 className="text-base font-bold text-white">Alterar senha de acesso</h3>
        <p className="text-sm text-slate-400">Troque a senha provisória fornecida pelo administrador. Use uma senha exclusiva com pelo menos 12 caracteres.</p>
        <form onSubmit={handlePasswordChange} className="flex flex-wrap gap-3">
          <input aria-label="Nova senha" type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="min-w-56 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Nova senha (12+ caracteres)" />
          <Button type="submit" disabled={passwordBusy}>{passwordBusy ? 'Salvando...' : 'Atualizar senha'}</Button>
        </form>
        {passwordMessage && <p role="status" className="text-sm text-amber-300">{passwordMessage}</p>}
      </Card>}
      {/* Persistência Local (IndexedDB) e Backups */}
      <Card className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          Armazenamento Local (IndexedDB Dexie 4.x)
        </h3>
        <p className="text-xs text-slate-400">
          Todos os registros operacionais são gravados primeiramente no navegador. Limpezas acidentais de cache podem comprometer dados não sincronizados. Exporte backups regulares.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
            <p className="text-xs text-slate-400">Produtos</p>
            <p className="text-xl font-bold text-white mt-1">{stats.products}</p>
          </div>
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
            <p className="text-xs text-slate-400">Vendas Gravadas</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{stats.sales}</p>
          </div>
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
            <p className="text-xs text-slate-400">Movimentações Estoque</p>
            <p className="text-xl font-bold text-sky-400 mt-1">{stats.movements}</p>
          </div>
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
            <p className="text-xs text-slate-400">Fila Outbox</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{stats.syncEvents}</p>
          </div>
        </div>

        <div className="pt-4 flex flex-wrap gap-4 border-t border-slate-800">
          <Button
            onClick={handleExportBackup}
            disabled={exporting}
            variant="secondary"
            className="gap-2"
          >
            <HardDriveDownload className="w-4 h-4 text-emerald-400" />
            <span>{exporting ? 'Gerando arquivo...' : 'Exportar Backup Completo JSON'}</span>
          </Button>

          <Button
            onClick={handleResetDemo}
            disabled={resetting}
            variant="danger"
            className="gap-2 ml-auto"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{resetting ? 'Resetando...' : 'Restaurar Dados de Fábrica'}</span>
          </Button>
        </div>
      </Card>

      {/* Modal de Criação de Operador */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Cadastrar Novo Operador
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userModalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {userModalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Nome do Operador *
                </label>
                <Input
                  required
                  placeholder="Ex: Maria Vendedora"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  E-mail de Login
                </label>
                <Input
                  type="email"
                  placeholder="maria@loja.com.br"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Papel / Perfil
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as RoleName)}
                    className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="cashier">Operador de Caixa</option>
                    <option value="manager">Gerente de Loja</option>
                    <option value="stockist">Estoquista</option>
                    <option value="owner">Proprietário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    PIN (4 dígitos) *
                  </label>
                  <Input
                    required
                    maxLength={4}
                    placeholder="Ex: 5566"
                    value={newUserPin}
                    onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsUserModalOpen(false)}
                  disabled={userSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={userSubmitting}>
                  Salvar Operador
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
