import { describe, it, expect } from 'vitest';
import { RBAC } from '../lib/services/userService';

describe('FASE 3: Matriz de Controle de Acesso e Alçadas (RBAC)', () => {
  it('deve restringir desconto do operador de caixa ao limite máximo de 10%', () => {
    // Caixa tentando dar 5% -> Permitido
    expect(RBAC.canApplyDiscount('cashier', 5)).toBe(true);
    // Caixa tentando dar 10% -> Permitido
    expect(RBAC.canApplyDiscount('cashier', 10)).toBe(true);
    // Caixa tentando dar 11% ou mais -> Bloqueado
    expect(RBAC.canApplyDiscount('cashier', 11)).toBe(false);
    expect(RBAC.canApplyDiscount('cashier', 50)).toBe(false);

    // Gerente e Proprietário têm alçada total
    expect(RBAC.canApplyDiscount('manager', 50)).toBe(true);
    expect(RBAC.canApplyDiscount('owner', 100)).toBe(true);
  });

  it('deve permitir estorno/cancelamento de venda apenas a proprietários e gerentes', () => {
    expect(RBAC.canCancelSale('owner')).toBe(true);
    expect(RBAC.canCancelSale('manager')).toBe(true);
    expect(RBAC.canCancelSale('cashier')).toBe(false);
    expect(RBAC.canCancelSale('stockist')).toBe(false);
  });

  it('deve permitir acesso ao financeiro apenas a proprietários e gerentes', () => {
    expect(RBAC.canAccessFinancials('owner')).toBe(true);
    expect(RBAC.canAccessFinancials('manager')).toBe(true);
    expect(RBAC.canAccessFinancials('cashier')).toBe(false);
    expect(RBAC.canAccessFinancials('stockist')).toBe(false);
  });

  it('deve permitir gestão de usuários apenas ao proprietário', () => {
    expect(RBAC.canManageUsers('owner')).toBe(true);
    expect(RBAC.canManageUsers('manager')).toBe(false);
    expect(RBAC.canManageUsers('cashier')).toBe(false);
  });
});
