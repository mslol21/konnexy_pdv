import React, { useState, useEffect, useCallback } from 'react';
import { 
  Boxes, 
  RefreshCw, 
  History, 
  Plus, 
  Minus, 
  Sliders,
  X
} from 'lucide-react';
import { db } from '../../lib/db';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  createInventoryMovement, 
  recalculateInventoryBalance 
} from '../../lib/services/inventoryService';
import { formatDateTimeBR } from '../../lib/utils/date';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { Product, InventoryMovement, InventoryBalance, MovementType } from '../../types/database';

export const InventoryPage: React.FC = () => {
  const { currentTenant, currentStore, currentUser, deviceId } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Movimentação Manual
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementType, setMovementType] = useState<MovementType>('purchase');
  const [quantityInput, setQuantityInput] = useState('10');
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTenant || !currentStore) return;
    setLoading(true);
    try {
      const [prods, bals, movs] = await Promise.all([
        db.products.where('[tenant_id+store_id]').equals([currentTenant.id, currentStore.id]).toArray(),
        db.inventory_balances.where('[tenant_id+store_id]').equals([currentTenant.id, currentStore.id]).toArray(),
        db.inventory_movements
          .where('[tenant_id+store_id]')
          .equals([currentTenant.id, currentStore.id])
          .reverse()
          .sortBy('created_at')
      ]);

      setProducts(prods);
      setBalances(bals);
      setMovements(movs.slice(0, 50));
      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar estoque:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, currentStore, selectedProductId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenMovementModal = (type: MovementType, prodId?: string) => {
    setMovementType(type);
    if (prodId) setSelectedProductId(prodId);
    setQuantityInput('5');
    setReasonInput('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !currentStore || !currentUser) return;
    setModalError(null);

    const qty = parseInt(quantityInput, 10);
    if (!qty || qty <= 0) {
      setModalError('Informe uma quantidade maior que zero.');
      return;
    }
    if (!reasonInput.trim()) {
      setModalError('Informe o motivo ou nota fiscal da movimentação.');
      return;
    }

    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) {
      setModalError('Selecione um produto.');
      return;
    }

    const effectiveQty = (movementType === 'loss' || movementType === 'transfer') ? -qty : qty;

    setSubmitting(true);
    try {
      await createInventoryMovement({
        tenantId: currentTenant.id,
        storeId: currentStore.id,
        deviceId,
        productId: prod.id,
        type: movementType,
        quantity: effectiveQty,
        unitCostCents: prod.cost_cents,
        reason: reasonInput.trim(),
        userId: currentUser.id,
        userName: currentUser.name
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecalculate = async (productId: string) => {
    if (!currentTenant || !currentStore) return;
    try {
      await recalculateInventoryBalance(currentTenant.id, currentStore.id, productId);
      await loadData();
    } catch (err) {
      alert('Erro ao recalcular saldo: ' + err);
    }
  };

  const balanceMap = React.useMemo(() => {
    const map = new Map<string, number>();
    balances.forEach((b) => map.set(b.product_id, b.current_stock));
    return map;
  }, [balances]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Carregando dados de estoque...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-400" />
            Controle de Estoque Imutável (Append-Only)
          </h2>
          <p className="text-sm text-slate-400">
            Histórico auditável de movimentações, sem mutação destrutiva de saldos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenMovementModal('purchase')}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Entrada (Compra)</span>
          </Button>

          <Button
            onClick={() => handleOpenMovementModal('loss')}
            variant="secondary"
            size="sm"
            className="gap-1.5"
          >
            <Minus className="w-4 h-4 text-rose-400" />
            <span>Registrar Baixa / Perda</span>
          </Button>
        </div>
      </div>

      <Card className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Boxes className="w-4 h-4 text-emerald-400" />
          Posição Atual de Saldos
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Produto</th>
                <th className="py-2.5 px-3 text-center">Saldo em Estoque</th>
                <th className="py-2.5 px-3 text-center">Estoque Mínimo</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {products.map((p) => {
                const stock = balanceMap.get(p.id) ?? 0;
                const isCritical = stock <= p.min_stock;

                return (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-semibold">{p.sku}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{p.name}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`font-black text-sm px-2.5 py-0.5 rounded ${
                          isCritical
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'text-emerald-400'
                        }`}
                      >
                        {stock} {p.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400">
                      {p.min_stock} {p.unit}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenMovementModal('purchase', p.id)}
                          className="p-1 text-slate-300 hover:text-emerald-400 rounded transition-colors cursor-pointer"
                          title="Lançar Entrada"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenMovementModal('loss', p.id)}
                          className="p-1 text-slate-300 hover:text-rose-400 rounded transition-colors cursor-pointer"
                          title="Lançar Baixa/Perda"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRecalculate(p.id)}
                          className="p-1 text-slate-400 hover:text-sky-400 rounded transition-colors cursor-pointer"
                          title="Recalcular Saldo pelo Histórico Completo"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          Histórico de Movimentações Auditáveis (Últimas 50)
        </h3>

        {movements.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Nenhuma movimentação registrada no histórico.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Data/Hora</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3 text-center">Quantidade</th>
                  <th className="py-2.5 px-3">Motivo / Documento</th>
                  <th className="py-2.5 px-3">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {movements.map((m) => {
                  const prod = products.find((p) => p.id === m.product_id);
                  const isPositive = m.quantity > 0;

                  return (
                    <tr key={m.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-400">{formatDateTimeBR(m.created_at)}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            m.type === 'purchase'
                              ? 'success'
                              : m.type === 'sale'
                              ? 'info'
                              : m.type === 'loss'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {m.type === 'purchase' && 'Entrada'}
                          {m.type === 'sale' && 'Venda'}
                          {m.type === 'loss' && 'Perda/Avaria'}
                          {m.type === 'adjustment' && 'Ajuste'}
                          {m.type === 'sale_cancel' && 'Estorno'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {prod ? prod.name : m.product_id}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 italic">{m.reason}</td>
                      <td className="py-2.5 px-3 text-slate-400">{m.user_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                Lançar Movimento de Estoque
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveMovement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Produto Selecionado *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name} (Atual: {balanceMap.get(p.id) ?? 0} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Tipo de Movimento
                  </label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as MovementType)}
                    className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="purchase">Entrada (Compra/NF)</option>
                    <option value="loss">Saída (Perda / Quebra / Avaria)</option>
                    <option value="adjustment">Ajuste de Balanço / Inventário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Quantidade *
                  </label>
                  <Input
                    required
                    type="number"
                    min="1"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Justificativa / Motivo / Nº Documento *
                </label>
                <Input
                  required
                  placeholder="Ex: NF 1234 Fornecedor ou Avaria identificada na gôndola"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                />
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
                  Gravar Movimento Imutável
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
