import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LoginPage } from '../features/auth/LoginPage';
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
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
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
