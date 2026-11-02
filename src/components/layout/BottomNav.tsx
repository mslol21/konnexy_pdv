import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard, Package, Banknote, Menu } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore';
import { cn } from '../../lib/utils/cn';

export const BottomNav: React.FC = () => {
  const { toggleSidebar } = useUiStore();

  const primaryItems = [
    { name: 'PDV', path: '/app/pdv', icon: ShoppingCart },
    { name: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { name: 'Produtos', path: '/app/products', icon: Package },
    { name: 'Caixa', path: '/app/cash', icon: Banknote },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-30 flex items-center justify-around px-2">
      {primaryItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2 rounded-lg text-xs font-medium transition-colors',
                isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              )
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">{item.name}</span>
          </NavLink>
        );
      })}

      <button
        onClick={toggleSidebar}
        className="flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
        aria-label="Mais opções"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[11px]">Menu</span>
      </button>
    </nav>
  );
};
