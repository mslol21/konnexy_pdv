import { db } from '../db';
import { hashOperatorPin } from '../security/operatorPin';
import type { UserRole, RoleName } from '../../types/database';
import { generateUUID } from '../utils/id';
import { getISOTimestamp } from '../utils/date';
import { enqueueSyncEvent } from '../sync/outbox';

export interface CreateUserParams {
  tenantId: string;
  storeId?: string;
  deviceId: string;
  name: string;
  email: string;
  role: RoleName;
  pin: string; // PIN de 4 dígitos
}

/**
 * Cadastra um novo operador no banco local com PIN e papel atribuído.
 */
export async function createUser(params: CreateUserParams): Promise<UserRole> {
  const now = getISOTimestamp();
  const userId = generateUUID();

  const userRole: UserRole = {
    id: userId,
    tenant_id: params.tenantId,
    user_id: userId,
    store_id: params.storeId || null,
    name: params.name.trim(),
    email: params.email.trim().toLowerCase(),
    role: params.role,
    pin_hash: await hashOperatorPin(params.pin.trim()),
    is_active: true,
    created_at: now,
    updated_at: now
  };

  await db.transaction('rw', [db.user_roles, db.sync_events], async () => {
    await db.user_roles.put(userRole);

    await enqueueSyncEvent({
      tenantId: params.tenantId,
      storeId: params.storeId || 'global',
      deviceId: params.deviceId,
      aggregateId: userId,
      aggregateType: 'user_role',
      operationType: 'INSERT',
      payload: { userRole }
    });
  });

  return userRole;
}

/**
 * Matriz de Permissões por Papel (RBAC).
 */
export const RBAC = {
  canApplyDiscount: (role: RoleName, requestedPercent: number): boolean => {
    if (role === 'owner' || role === 'manager') return true;
    if (role === 'cashier') return requestedPercent <= 10;
    return false;
  },

  canCancelSale: (role: RoleName): boolean => {
    return role === 'owner' || role === 'manager';
  },

  canOpenCloseCash: (role: RoleName): boolean => {
    return role === 'owner' || role === 'manager' || role === 'cashier';
  },

  canAccessFinancials: (role: RoleName): boolean => {
    return role === 'owner' || role === 'manager';
  },

  canManageStock: (role: RoleName): boolean => {
    return role === 'owner' || role === 'manager' || role === 'stockist';
  },

  canManageUsers: (role: RoleName): boolean => {
    return role === 'owner';
  }
};
