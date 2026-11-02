import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  ShoppingBag, 
  Building2, 
  X
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  createCustomer, 
  searchCustomers, 
  createSupplier, 
  listSuppliers, 
  getCustomerSales 
} from '../../lib/services/customerService';
import { formatCentsToBRL } from '../../lib/utils/currency';
import { formatDateTimeBR } from '../../lib/utils/date';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { Customer, Supplier, Sale } from '../../types/database';

export const CustomersPage: React.FC = () => {
  const { currentTenant, deviceId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Histórico de compras
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Modais de Criação
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Campos Customer
  const [custName, setCustName] = useState('');
  const [custDoc, setCustDoc] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Campos Supplier
  const [suppName, setSuppName] = useState('');
  const [suppDoc, setSuppDoc] = useState('');
  const [suppContact, setSuppContact] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppEmail, setSuppEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const [cList, sList] = await Promise.all([
        searchCustomers(currentTenant.id, searchQuery),
        listSuppliers(currentTenant.id)
      ]);
      setCustomers(cList);
      setSuppliers(sList);
    } catch (err) {
      console.error('Erro ao listar pessoas:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectCustomer = async (cust: Customer) => {
    if (!currentTenant) return;
    setSelectedCustomer(cust);
    setLoadingSales(true);
    try {
      const sales = await getCustomerSales(currentTenant.id, cust.id);
      setCustomerSales(sales);
    } catch (err) {
      console.error('Erro ao buscar histórico do cliente:', err);
    } finally {
      setLoadingSales(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;
    if (!custName.trim()) {
      setFormError('Informe o nome do cliente.');
      return;
    }

    setSubmitting(true);
    try {
      await createCustomer({
        tenantId: currentTenant.id,
        deviceId,
        name: custName.trim(),
        document: custDoc.trim() || undefined,
        email: custEmail.trim() || undefined,
        phone: custPhone.trim() || undefined
      });
      setIsCustomerModalOpen(false);
      setCustName('');
      setCustDoc('');
      setCustEmail('');
      setCustPhone('');
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;
    if (!suppName.trim()) {
      setFormError('Informe o nome da empresa fornecedora.');
      return;
    }

    setSubmitting(true);
    try {
      await createSupplier({
        tenantId: currentTenant.id,
        deviceId,
        name: suppName.trim(),
        document: suppDoc.trim() || undefined,
        contactName: suppContact.trim() || undefined,
        phone: suppPhone.trim() || undefined,
        email: suppEmail.trim() || undefined
      });
      setIsSupplierModalOpen(false);
      setSuppName('');
      setSuppDoc('');
      setSuppContact('');
      setSuppPhone('');
      setSuppEmail('');
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Clientes & Fornecedores Locais
          </h2>
          <p className="text-sm text-slate-400">
            Base de contatos mínimos locais em conformidade com as diretrizes da LGPD
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'customers' ? (
            <Button
              onClick={() => {
                setFormError(null);
                setIsCustomerModalOpen(true);
              }}
              variant="primary"
              className="gap-2 font-bold shadow-lg shadow-emerald-950/50"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cliente</span>
            </Button>
          ) : (
            <Button
              onClick={() => {
                setFormError(null);
                setIsSupplierModalOpen(true);
              }}
              variant="primary"
              className="gap-2 font-bold shadow-lg shadow-emerald-950/50"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Fornecedor</span>
            </Button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => {
            setActiveTab('customers');
            setSelectedCustomer(null);
          }}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'customers'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clientes ({customers.length})</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('suppliers');
            setSelectedCustomer(null);
          }}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'suppliers'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Fornecedores ({suppliers.length})</span>
        </button>
      </div>

      {/* Conteúdo Clientes */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Pesquisar por nome ou CPF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <Card className="p-0 overflow-hidden border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">CPF / Documento</th>
                      <th className="py-3 px-4">Telefone</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          Carregando clientes...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          Nenhum cliente cadastrado.
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-800/40 cursor-pointer ${
                            selectedCustomer?.id === c.id ? 'bg-emerald-600/10' : ''
                          }`}
                          onClick={() => handleSelectCustomer(c)}
                        >
                          <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">{c.document || '-'}</td>
                          <td className="py-3 px-4 text-slate-400">{c.phone || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-emerald-400 font-bold hover:underline">
                              Ver Histórico
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Painel Lateral: Histórico de Compras do Cliente Selecionado */}
          <div className="lg:col-span-1">
            <Card className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                Histórico de Compras
              </h3>

              {!selectedCustomer ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Selecione um cliente ao lado para visualizar suas compras e ticket médio.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-white text-sm">{selectedCustomer.name}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      CPF: {selectedCustomer.document || 'Não informado'}
                    </p>
                  </div>

                  <div className="divide-y divide-slate-800 border-t border-slate-800 pt-2">
                    {loadingSales ? (
                      <p className="text-xs text-slate-500 py-3 text-center">Buscando vendas...</p>
                    ) : customerSales.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">
                        Nenhuma venda registrada com este cliente.
                      </p>
                    ) : (
                      customerSales.map((s) => (
                        <div key={s.id} className="py-2.5 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-semibold text-white">Venda #{s.sale_number}</p>
                            <p className="text-[10px] text-slate-400">{formatDateTimeBR(s.created_at)}</p>
                          </div>
                          <span className="font-bold text-emerald-400">
                            {formatCentsToBRL(s.total_cents)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Conteúdo Fornecedores */}
      {activeTab === 'suppliers' && (
        <Card className="p-0 overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Empresa Fornecedora</th>
                  <th className="py-3 px-4">CNPJ</th>
                  <th className="py-3 px-4">Pessoa de Contato</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">E-mail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Nenhum fornecedor cadastrado.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white">{s.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{s.document || '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{s.contact_name || '-'}</td>
                      <td className="py-3 px-4 text-slate-400">{s.phone || '-'}</td>
                      <td className="py-3 px-4 text-slate-400">{s.email || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal de Criação de Cliente */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Cadastrar Cliente Local
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Nome do Cliente *
                </label>
                <Input
                  required
                  placeholder="Nome completo"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  CPF (Para Nota/Comprovante)
                </label>
                <Input
                  placeholder="000.000.000-00"
                  value={custDoc}
                  onChange={(e) => setCustDoc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Telefone / WhatsApp
                  </label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    E-mail
                  </label>
                  <Input
                    type="email"
                    placeholder="cliente@email.com"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCustomerModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  Salvar Cliente
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Criação de Fornecedor */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Cadastrar Fornecedor Local
              </h3>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Razão Social / Nome Fantasia *
                </label>
                <Input
                  required
                  placeholder="Nome da empresa fornecedora"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    CNPJ
                  </label>
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={suppDoc}
                    onChange={(e) => setSuppDoc(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Contato Responsável
                  </label>
                  <Input
                    placeholder="Nome do representante"
                    value={suppContact}
                    onChange={(e) => setSuppContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Telefone
                  </label>
                  <Input
                    placeholder="(00) 0000-0000"
                    value={suppPhone}
                    onChange={(e) => setSuppPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    E-mail
                  </label>
                  <Input
                    type="email"
                    placeholder="comercial@fornecedor.com"
                    value={suppEmail}
                    onChange={(e) => setSuppEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsSupplierModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  Salvar Fornecedor
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
