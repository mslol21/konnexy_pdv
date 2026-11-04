import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Package, 
  Boxes, 
  Banknote, 
  ReceiptText, 
  BarChart3, 
  Settings, 
  LogOut,
  Users
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUiStore } from '../../store/useUiStore';
import { cn } from '../../lib/utils/cn';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Frente de Caixa (PDV)', path: '/app/pdv', icon: ShoppingCart, badge: 'Balcão' },
  { name: 'Visão Geral (Dashboard)', path: '/app', icon: LayoutDashboard },
  { name: 'Produtos & Catálogo', path: '/app/products', icon: Package },
  { name: 'Controle de Estoque', path: '/app/inventory', icon: Boxes },
  { name: 'Operações de Caixa', path: '/app/cash', icon: Banknote },
  { name: 'Contas & Financeiro', path: '/app/financial', icon: ReceiptText },
  { name: 'Relatórios Gerenciais', path: '/app/reports', icon: BarChart3 },
  { name: 'Clientes & Pessoas', path: '/app/customers', icon: Users },
  { name: 'Configurações & Terminal', path: '/app/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const { logout } = useAuthStore();

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [setSidebarOpen]);

  return (
    <>
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu lateral"
          className="fixed inset-0 bg-slate-950/70 z-30 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={cn(
          'fixed lg:static top-0 bottom-0 left-0 z-40 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 w-64',
          !sidebarOpen && 'lg:w-20 -translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col flex-1 overflow-y-auto py-4">
          <nav className="space-y-1.5 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all group min-h-[44px]',
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                    )
                  }
                  title={item.name}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className={cn('truncate', !sidebarOpen && 'lg:hidden')}>
                    {item.name}
                  </span>
                  {item.badge && sidebarOpen && (
                    <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-800/80">
          <button
            onClick={logout}
            className={cn(
              'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer min-h-[44px]',
              !sidebarOpen && 'lg:justify-center'
            )}
            title="Sair do Sistema"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={cn('truncate', !sidebarOpen && 'lg:hidden')}>
              Encerrar Sessão
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
