import React from 'react';
import { Menu, User, Store as StoreIcon, Lock, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUiStore } from '../../store/useUiStore';
import { StatusIndicator } from '../ui/StatusIndicator';

export const Header: React.FC = () => {
  const { currentUser, currentStore, lockSession } = useAuthStore();
  const { toggleSidebar, theme, toggleTheme } = useUiStore();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Alternar Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-base shadow-sm">
            K
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight flex items-center gap-2">
              Konnexy PDV
              <span className="text-[10px] font-normal text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded">
                v0.1.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <StoreIcon className="w-3 h-3 text-emerald-400 inline" />
              <span>{currentStore?.name || 'Loja Matriz'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <StatusIndicator />

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
          title="Alternar Tema Claro/Escuro"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
        </button>

        <button
          onClick={lockSession}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
          title="Bloquear Terminal (Requer PIN para desbloquear)"
        >
          <Lock className="w-4 h-4 text-slate-300" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-white truncate max-w-[120px]">
              {currentUser?.name || 'Operador'}
            </p>
            <p className="text-[10px] text-emerald-400 uppercase font-medium">
              {currentUser?.role === 'owner' ? 'Proprietário' : currentUser?.role === 'cashier' ? 'Caixa' : 'Operador'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
