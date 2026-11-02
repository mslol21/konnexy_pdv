import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Download, 
  X
} from 'lucide-react';
import { db } from '../../lib/db';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  createProduct, 
  searchLocalProducts, 
  exportProductsToCSV 
} from '../../lib/services/productService';
import { formatCentsToBRL, parseBRLToCents } from '../../lib/utils/currency';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { Product, Category } from '../../types/database';

export const ProductsPage: React.FC = () => {
  const { currentTenant, currentStore, currentUser, deviceId } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('UN');
  const [costInput, setCostInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [minStockInput, setMinStockInput] = useState('10');
  const [initialStockInput, setInitialStockInput] = useState('20');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTenant || !currentStore) return;
    setLoading(true);
    try {
      const [cats, prods, bals] = await Promise.all([
        db.categories.where('[tenant_id+store_id]').equals([currentTenant.id, currentStore.id]).toArray(),
        searchLocalProducts(currentTenant.id, currentStore.id, searchQuery),
        db.inventory_balances.where('[tenant_id+store_id]').equals([currentTenant.id, currentStore.id]).toArray()
      ]);

      const balMap: Record<string, number> = {};
      bals.forEach((b) => {
        balMap[b.product_id] = b.current_stock;
      });

      setCategories(cats);
      setProducts(prods);
      setBalances(balMap);
    } catch (err) {
      console.error('Erro ao carregar catálogo de produtos:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, currentStore, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreateModal = () => {
    setName('');
    setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setBarcode('');
    setCategoryId(categories[0]?.id || '');
    setUnit('UN');
    setCostInput('5,00');
    setPriceInput('10,00');
    setPromoInput('');
    setMinStockInput('10');
    setInitialStockInput('20');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !currentStore || !currentUser) return;
    setFormError(null);

    const costCents = parseBRLToCents(costInput);
    const priceCents = parseBRLToCents(priceInput);
    const promoCents = promoInput ? parseBRLToCents(promoInput) : null;
    const minStock = parseInt(minStockInput, 10) || 0;
    const initialStock = parseInt(initialStockInput, 10) || 0;

    if (!name.trim()) {
      setFormError('Informe o nome do produto.');
      return;
    }
    if (!sku.trim()) {
      setFormError('Informe o código SKU.');
      return;
    }
    if (priceCents <= 0) {
      setFormError('O preço de venda deve ser maior que zero.');
      return;
    }

    setSubmitting(true);
    try {
      await createProduct({
        tenantId: currentTenant.id,
        storeId: currentStore.id,
        deviceId,
        categoryId: categoryId || undefined,
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
        name: name.trim(),
        unit: unit.trim().toUpperCase() || 'UN',
        costCents,
        priceCents,
        promoPriceCents: promoCents,
        minStock,
        initialStock,
        userId: currentUser.id,
        userName: currentUser.name
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!currentTenant || !currentStore) return;
    const csvContent = await exportProductsToCSV(currentTenant.id, currentStore.id);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `produtos-konnexy-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            Catálogo de Produtos & Variantes
          </h2>
          <p className="text-sm text-slate-400">
            Cadastros com SKU único, código de barras, controle de preço e estoque mínimo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCSV}
            variant="secondary"
            size="sm"
            className="gap-1.5"
            title="Exportar para arquivo CSV"
          >
            <Download className="w-4 h-4 text-slate-300" />
            <span>Exportar CSV</span>
          </Button>

          <Button
            onClick={handleOpenCreateModal}
            variant="primary"
            className="gap-2 font-bold shadow-lg shadow-emerald-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Pesquisar por nome, SKU ou código de barras..."
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
                <th className="py-3 px-4">SKU / Código</th>
                <th className="py-3 px-4">Nome do Produto</th>
                <th className="py-3 px-4">Unidade</th>
                <th className="py-3 px-4">Custo</th>
                <th className="py-3 px-4">Preço Venda</th>
                <th className="py-3 px-4 text-center">Estoque Atual</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Carregando produtos locais...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum produto cadastrado com os critérios de busca.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const stock = balances[p.id] ?? 0;
                  const isLow = stock <= p.min_stock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                        {p.sku}
                        {p.barcode && (
                          <span className="block text-[10px] text-slate-500">{p.barcode}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {p.name}
                      </td>
                      <td className="py-3 px-4 uppercase font-bold text-slate-400">{p.unit}</td>
                      <td className="py-3 px-4 text-slate-400">{formatCentsToBRL(p.cost_cents)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {formatCentsToBRL(p.price_cents)}
                        {p.promo_price_cents && (
                          <span className="block text-[10px] text-amber-400 font-normal">
                            Promo: {formatCentsToBRL(p.promo_price_cents)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-black text-sm px-2 py-0.5 rounded ${
                            isLow
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'text-slate-100'
                          }`}
                        >
                          {stock}
                        </span>
                        <span className="block text-[10px] text-slate-500">Mín: {p.min_stock}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={p.is_active ? 'success' : 'neutral'}>
                          {p.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Cadastrar Novo Produto
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

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Nome do Produto *
                </label>
                <Input
                  required
                  placeholder="Ex: Água Mineral Sem Gás 500ml"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Código SKU (Único) *
                  </label>
                  <Input
                    required
                    placeholder="Ex: BEB-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Código de Barras (EAN)
                  </label>
                  <Input
                    placeholder="Ex: 7891234567890"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Sem Categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Unidade de Medida
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="KG">KG (Quilo)</option>
                    <option value="L">L (Litro)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="PCT">PCT (Pacote)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Preço Custo (R$)
                  </label>
                  <Input
                    placeholder="0,00"
                    value={costInput}
                    onChange={(e) => setCostInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Preço Venda (R$) *
                  </label>
                  <Input
                    required
                    placeholder="0,00"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Preço Promo (R$)
                  </label>
                  <Input
                    placeholder="Opcional"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Estoque Mínimo (Alerta)
                  </label>
                  <Input
                    type="number"
                    value={minStockInput}
                    onChange={(e) => setMinStockInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Estoque Inicial de Lançamento
                  </label>
                  <Input
                    type="number"
                    value={initialStockInput}
                    onChange={(e) => setInitialStockInput(e.target.value)}
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
                  Salvar Produto Localmente
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
