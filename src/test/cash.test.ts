import { describe, it, expect, beforeEach } from 'vitest';
import { seedDemoData, DEMO_TENANT_ID, DEMO_STORE_ID, DEMO_DEVICE_ID, DEMO_USER_ID } from '../lib/db/seed';
import { addCashMovement, closeCashSession, getActiveCashSession } from '../lib/services/cashService';

describe('FASE 2: Controle de Sessão de Caixa (Abertura, Movimentos, Fechamento)', () => {
  beforeEach(async () => {
    await seedDemoData(true);
  });

  it('deve realizar sangria e suprimento e calcular saldo esperado no fechamento', async () => {
    const session = await getActiveCashSession(DEMO_TENANT_ID, DEMO_STORE_ID, DEMO_DEVICE_ID);
    expect(session).toBeDefined();
    if (!session) return;

    expect(session.initial_amount_cents).toBe(15000);

    await addCashMovement({
      cashSessionId: session.id,
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      userId: DEMO_USER_ID,
      userName: 'Ana Teste',
      type: 'supply',
      amountCents: 5000,
      reason: 'Troco em moedas para o caixa'
    });

    await addCashMovement({
      cashSessionId: session.id,
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      userId: DEMO_USER_ID,
      userName: 'Ana Teste',
      type: 'bleed',
      amountCents: 3000,
      reason: 'Pagamento de entrega motoboy'
    });

    const closed = await closeCashSession({
      cashSessionId: session.id,
      tenantId: DEMO_TENANT_ID,
      storeId: DEMO_STORE_ID,
      deviceId: DEMO_DEVICE_ID,
      userId: DEMO_USER_ID,
      userName: 'Ana Gerente',
      finalAmountCents: 17500,
      notes: 'Fechamento turno manhã'
    });

    expect(closed.status).toBe('closed');
    expect(closed.expected_amount_cents).toBe(17000);
    expect(closed.final_amount_cents).toBe(17500);
    expect(closed.difference_cents).toBe(500);

    const activeAfterClose = await getActiveCashSession(DEMO_TENANT_ID, DEMO_STORE_ID, DEMO_DEVICE_ID);
    expect(activeAfterClose).toBeNull();
  });
});
