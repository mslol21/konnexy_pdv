import React, { useState, useEffect, useCallback } from 'react';
import { 
  ReceiptText, 
  Plus, 
  TrendingUp, 
  X
} from 'lucide-react';
import { db } from '../../lib/db';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  createFinancialEntry, 
  settleFinancialEntry, 
  calculateDRE, 
  type DREMetrics 
} from '../../lib/services/financialService';
import { formatCentsToBRL, parseBRLToCents } from '../../lib/utils/currency';
import { formatDateBR } from '../../lib/utils/date';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { FinancialEntry, FinancialType } from '../../types/database';

export const FinancialPage: React.FC = () => {
  const { currentTenant, currentStore, deviceId } = useAuthStore();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [dre, setDre] = useState<DREMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<'entries' | 'dre'>('entries');
  const [typeFilter, setTypeFilter] = useState<'all' | 'payable' | 'receivable'>('all');
  const [loading, setLoading] = useState(true);

  // Modal de Criação de Lançamento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<FinancialType>('payable');
  const [category, setCategory] = useState('Aluguel');
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTenant || !currentStore) return;
    setLoading(true);
    try {
      const [allEntries, dreMetrics] = await Promise.all([
        db.financial_entries
          .where('[tenant_id+store_id]')
          .equals([currentTenant.id, currentStore.id])
          .reverse()
          .sortBy('due_date'),
        calculateDRE(currentTenant.id, currentStore.id)
      ]);

      setEntries(allEntries);
      setDre(dreMetrics);
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, currentStore]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !currentStore) return;
    setFormError(null);

    const cents = parseBRLToCents(amountInput);
    if (cents <= 0) {
      setFormError('Informe um valor monetário válido.');
      return;
    }
    if (!description.trim()) {
      setFormError('Informe a descrição do lançamento.');
      return;
    }

    setSubmitting(true);
    try {
      await createFinancialEntry({
        tenantId: currentTenant.id,
        storeId: currentStore.id,
        deviceId,
        type: entryType,
        category,
        description: description.trim(),
        amountCents: cents,
        dueDate
      });

      setIsModalOpen(false);
      setDescription('');
      setAmountInput('');
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async (entry: FinancialEntry) => {
    if (!currentTenant || !currentStore) return;
    if (confirm(`Confirmar baixa/quitação de ${formatCentsToBRL(entry.amount_cents)} (${entry.description})?`)) {
      try {
        await settleFinancialEntry({
          entryId: entry.id,
          tenantId: currentTenant.id,
          storeId: currentStore.id,
          deviceId,
          paidAmountCents: entry.amount_cents
        });
        await loadData();
      } catch (err) {
        alert('Erro ao baixar título: ' + err);
      }
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (typeFilter === 'all') return true;
    return e.type === typeFilter;
  });

  const totalPayablePending = entries
    .filter((e) => e.type === 'payable' && e.status === 'pending')
    .reduce((acc, e) => acc + e.amount_cents, 0);

  const totalReceivablePending = entries
    .filter((e) => e.type === 'receivable' && e.status === 'pending')
    .reduce((acc, e) => acc + e.amount_cents, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-emerald-400" />
            Gestão Financeira & DRE Gerencial
          </h2>
          <p className="text-sm text-slate-400">
            Contas a pagar, contas a receber, conciliação e apuração de margem bruta (Receita Líquida - CMV)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEntryType('payable');
              setCategory('Fornecedores');
              setDescription('');
              setAmountInput('150,00');
              setFormError(null);
              setIsModalOpen(true);
            }}
            variant="primary"
            className="gap-2 font-bold shadow-lg shadow-emerald-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Título Financeiro</span>
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total a Pagar (Pendentes)
          </span>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-400">
              {formatCentsToBRL(totalPayablePending)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Obrigações futuras e despesas</p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total a Receber (Pendentes)
          </span>
          <div className="mt-3">
            <p className="text-2xl font-black text-sky-400">
              {formatCentsToBRL(totalReceivablePending)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Créditos de clientes e convênios</p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Margem Bruta Estimada (DRE)
          </span>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-400">
              {dre ? formatCentsToBRL(dre.grossMarginCents) : 'R$ 0,00'}
            </p>
            <p className="text-xs text-emerald-400/80 mt-1 font-semibold">
              {dre ? `${dre.grossMarginPercent}% de margem sobre vendas` : '-'}
            </p>
          </div>
        </Card>
      </div>

      {/* Navegação entre Abas */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('entries')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'entries'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Contas a Pagar & Receber ({entries.length})
        </button>
        <button
          onClick={() => setActiveTab('dre')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'dre'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Demonstrativo de Resultado (DRE & CMV)
        </button>
      </div>

      {/* Conteúdo da Aba 1: Títulos a Pagar e Receber */}
      {activeTab === 'entries' && (
        <Card className="p-0 overflow-hidden border border-slate-800 space-y-0">
          <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Filtrar por:</span>
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setTypeFilter('payable')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === 'payable' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                A Pagar
              </button>
              <button
                onClick={() => setTypeFilter('receivable')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === 'receivable' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                A Receber
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850/50 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Carregando lançamentos...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Nenhum título encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((e) => {
                    const isPaid = e.status === 'paid';
                    const isPayable = e.type === 'payable';

                    return (
                      <tr key={e.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <Badge variant={isPayable ? 'danger' : 'info'}>
                            {isPayable ? 'A Pagar' : 'A Receber'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">{formatDateBR(e.due_date)}</td>
                        <td className="py-3 px-4 text-slate-400">{e.category}</td>
                        <td className="py-3 px-4 font-semibold text-white">{e.description}</td>
                        <td className="py-3 px-4 text-right font-black">
                          <span className={isPayable ? 'text-rose-400' : 'text-sky-400'}>
                            {formatCentsToBRL(e.amount_cents)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={isPaid ? 'success' : 'warning'}>
                            {isPaid ? 'Quitado' : 'Pendente'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {!isPaid ? (
                            <button
                              onClick={() => handleSettle(e)}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Dar Baixa
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500">Quitado em {formatDateBR(e.paid_date || '')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Conteúdo da Aba 2: DRE Gerencial */}
      {activeTab === 'dre' && dre && (
        <Card className="space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Demonstrativo de Resultado do Exercício (DRE)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Apuração contábil precisa separando Faturamento Bruto de Lucro Real com abatimento do CMV dos itens vendidos
            </p>
          </div>

          <div className="space-y-3 font-mono text-sm max-w-2xl">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-300">(+) Receita Bruta de Vendas</span>
              <span className="font-bold text-white">{formatCentsToBRL(dre.grossSalesCents)}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800 text-rose-400">
              <span>(-) Descontos Concedidos no Balcão</span>
              <span>-{formatCentsToBRL(dre.discountsCents)}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-700 font-bold text-emerald-400">
              <span>(=) Receita Líquida de Vendas</span>
              <span>{formatCentsToBRL(dre.netSalesCents)}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800 text-amber-400">
              <div>
                <span>(-) CMV (Custo das Mercadorias Vendidas)</span>
                <span className="block text-[10px] text-slate-500 font-sans">
                  Soma dos custos unitários dos produtos baixados em vendas
                </span>
              </div>
              <span className="font-bold">-{formatCentsToBRL(dre.cmvCents)}</span>
            </div>

            <div className="flex justify-between py-2.5 border-b-2 border-emerald-500 font-black text-base bg-emerald-500/10 px-3 rounded-lg text-emerald-300">
              <span>(=) LUCRO / MARGEM BRUTA ESTIMADA</span>
              <div className="text-right">
                <span>{formatCentsToBRL(dre.grossMarginCents)}</span>
                <span className="block text-xs font-normal">({dre.grossMarginPercent}%)</span>
              </div>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800 text-rose-400">
              <span>(-) Despesas Operacionais Pagas</span>
              <span>-{formatCentsToBRL(dre.operatingExpensesCents)}</span>
            </div>

            <div className="flex justify-between py-3 border-t-2 border-slate-600 font-black text-lg text-white">
              <span>(=) RESULTADO OPERACIONAL ESTIMADO</span>
              <span className={dre.estimatedProfitCents >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatCentsToBRL(dre.estimatedProfitCents)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Modal de Criação de Lançamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Novo Lançamento Financeiro
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleCreateEntry} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Tipo de Título
                  </label>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as FinancialType)}
                    className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="payable">Conta a Pagar (Despesa)</option>
                    <option value="receivable">Conta a Receber (Receita)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Fornecedores">Fornecedores</option>
                    <option value="Aluguel">Aluguel / Imóvel</option>
                    <option value="Energia & Água">Energia & Água</option>
                    <option value="Internet & Telefone">Internet & Telefone</option>
                    <option value="Salários">Salários & Pessoal</option>
                    <option value="Manutenção">Manutenção & Reparos</option>
                    <option value="Vendas Balcão">Vendas / Receitas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Descrição do Lançamento *
                </label>
                <Input
                  required
                  placeholder="Ex: Fatura Fornecedor Bebidas ou Conta de Luz"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Valor (R$) *
                  </label>
                  <Input
                    required
                    placeholder="0,00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Data de Vencimento *
                  </label>
                  <Input
                    required
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  Salvar Lançamento
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
