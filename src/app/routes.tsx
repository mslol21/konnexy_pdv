import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LoginPage } from '../features/auth/LoginPage';
import { LandingPage } from '../features/landing/LandingPage';
import { MasterPage } from '../features/master/MasterPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { PdvPage } from '../features/pdv/PdvPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { CashPage } from '../features/cash/CashPage';
import { FinancialPage } from '../features/financial/FinancialPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { CustomersPage } from '../features/customers/CustomersPage';
import { useAuthStore } from '../store/useAuthStore';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const location = useLocation();

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Restaurando sessão...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/master" element={<MasterPage />} />

      {/* Aliases diretos para fácil navegação e compatibilidade */}
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="/pdv" element={<Navigate to="/app/pdv" replace />} />
      <Route path="/cash" element={<Navigate to="/app/cash" replace />} />
      <Route path="/inventory" element={<Navigate to="/app/inventory" replace />} />
      <Route path="/products" element={<Navigate to="/app/products" replace />} />
      <Route path="/financial" element={<Navigate to="/app/financial" replace />} />
      <Route path="/reports" element={<Navigate to="/app/reports" replace />} />
      <Route path="/customers" element={<Navigate to="/app/customers" replace />} />
      <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        
        {/* Módulos Operacionais Reais (FASE 2) */}
        <Route path="pdv" element={<PdvPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="cash" element={<CashPage />} />

        {/* Módulos de Gestão, Relatórios e Pessoas Reais (FASE 3) */}
        <Route path="financial" element={<FinancialPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
