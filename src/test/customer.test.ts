import { describe, it, expect, beforeEach } from 'vitest';
import { seedDemoData, DEMO_TENANT_ID, DEMO_DEVICE_ID } from '../lib/db/seed';
import { createCustomer, searchCustomers, createSupplier, listSuppliers } from '../lib/services/customerService';

describe('FASE 3: Cadastro de Clientes e Fornecedores', () => {
  beforeEach(async () => {
    await seedDemoData(true);
  });

  it('deve cadastrar cliente com dados mínimos LGPD e localizar na busca', async () => {
    const cust = await createCustomer({
      tenantId: DEMO_TENANT_ID,
      deviceId: DEMO_DEVICE_ID,
      name: 'João da Silva Varejo',
      document: '123.456.789-00',
      phone: '(11) 99999-8888',
      email: 'joao@email.com'
    });

    expect(cust.id).toBeDefined();

    const results = await searchCustomers(DEMO_TENANT_ID, 'Silva');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('João da Silva');

    const resultsByDoc = await searchCustomers(DEMO_TENANT_ID, '123.456');
    expect(resultsByDoc.length).toBeGreaterThan(0);
  });

  it('deve cadastrar fornecedor com CNPJ e listar com sucesso', async () => {
    const supp = await createSupplier({
      tenantId: DEMO_TENANT_ID,
      deviceId: DEMO_DEVICE_ID,
      name: 'Distribuidora Central de Alimentos Ltda',
      document: '99.888.777/0001-66',
      contactName: 'Marcos Vendas',
      phone: '(11) 3333-4444'
    });

    expect(supp.id).toBeDefined();

    const list = await listSuppliers(DEMO_TENANT_ID);
    expect(list.some((s) => s.name.includes('Distribuidora Central'))).toBe(true);
  });
});
