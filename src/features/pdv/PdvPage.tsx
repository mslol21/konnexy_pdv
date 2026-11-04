import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  AlertTriangle, 
  Percent, 
  CreditCard, 
  RotateCcw,
  Tag
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import { useAuthStore } from '../../store/useAuthStore';
import { useBarcodeScanner } from '../../lib/hooks/useBarcodeScanner';
import { searchLocalProducts, findProductByBarcodeOrSku } from '../../lib/services/productService';
import { executeSaleAtomic } from '../../lib/services/saleService';
import { getActiveCashSession } from '../../lib/services/cashService';
import { formatCentsToBRL, calculateDiscount } from '../../lib/utils/currency';
import { Button } from '../../components/ui/Button';
import { PaymentModal, type PaymentItem } from './PaymentModal';
import { ReceiptModal } from '../../components/ReceiptModal';
import type { Product, Category, CashSession, Sale, SaleItem, SalePayment } from '../../types/database';

interface CartItem {
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  barcode?: string;
  unitPriceCents: number;
  unitCostCents: number;
  quantity: number;
  discountCents: number;
}

export const PdvPage: React.FC = () => {
  const { currentTenant, currentStore, currentUser, deviceId } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Desconto geral
  const [discountType, setDiscountType] = useState<'percent' | 'cents'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [customerName] = useState('');
  const [customerDoc] = useState('');

  // Modais
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [completedSale, setCompletedSale] = useState<{
    sale: Sale;
    items: SaleItem[];
    payments: SalePayment[];
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTenant || !currentStore) return;
    setLoading(true);
    try {
      const [cats, session, prods] = await Promise.all([
        db.categories.where('[tenant_id+store_id]').equals([currentTenant.id, currentStore.id]).toArray(),
        getActiveCashSession(currentTenant.id, currentStore.id, deviceId),
        searchLocalProducts(currentTenant.id, currentStore.id, searchQuery)
      ]);
      setCategories(cats);
      setActiveSession(session);
      setProducts(prods);
    } catch (err) {
      console.error('Erro ao carregar dados do PDV:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, currentStore, deviceId, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addToCart = useCallback((product: Product) => {
    const effectivePrice = (product.promo_price_cents && product.promo_price_cents > 0)
      ? product.promo_price_cents
      : product.price_cents;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex].quantity += 1;
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unitPriceCents: effectivePrice,
          unitCostCents: product.cost_cents,
          quantity: 1,
          discountCents: 0
        }
      ];
    });
  }, []);

  useBarcodeScanner({
    onScan: async (barcode) => {
      if (!currentTenant || !currentStore) return;
      const found = await findProductByBarcodeOrSku(currentTenant.id, currentStore.id, barcode);
      if (found) {
        addToCart(found);
      } else {
        alert(`Produto com código de barras "${barcode}" não encontrado no catálogo local.`);
      }
    }
  });

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, idx) => idx !== index);
      }
      next[index].quantity = newQty;
      return next;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
  };

  const subtotalCents = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.unitPriceCents * item.quantity), 0);
  }, [cart]);

  const maxDiscountAllowedPercent = currentUser?.role === 'cashier' ? 10 : 100;

  const { finalCents: totalCents, discountCents } = useMemo(() => {
    let effectiveValue = discountValue;
    if (discountType === 'percent' && discountValue > maxDiscountAllowedPercent) {
      effectiveValue = maxDiscountAllowedPercent;
    }
    return calculateDiscount(subtotalCents, discountType, effectiveValue);
  }, [subtotalCents, discountType, discountValue, maxDiscountAllowedPercent]);

  const handleConfirmSale = async (paymentsList: PaymentItem[]) => {
    if (!currentTenant || !currentStore || !currentUser || !activeSession) return;
    setIsProcessingSale(true);

    try {
      const saleResult = await executeSaleAtomic({
        tenantId: currentTenant.id,
        storeId: currentStore.id,
        deviceId,
        cashSessionId: activeSession.id,
        userId: currentUser.id,
        userName: currentUser.name,
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          unitCostCents: item.unitCostCents,
          discountCents: item.discountCents,
          totalCents: (item.unitPriceCents * item.quantity) - item.discountCents
        })),
        payments: paymentsList.map((p) => ({
          paymentMethod: p.method,
          amountCents: p.amountCents,
          receivedCents: p.receivedCents,
          changeCents: p.changeCents
        })),
        subtotalCents,
        discountCents,
        additionCents: 0,
        totalCents,
        customerName: customerName || undefined,
        customerDocument: customerDoc || undefined
      });

      setCompletedSale(saleResult);
      setIsPaymentOpen(false);
      clearCart();
    } catch (err: unknown) {
      alert(`Falha ao registrar venda: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessingSale(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter((p) => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 lg:h-[calc(100dvh-12rem)] lg:min-h-[420px] lg:flex-row lg:overflow-hidden max-w-7xl mx-auto">
      {/* Lado Esquerdo: Catálogo & Pesquisa Rápida */}
      <div className="flex flex-col min-w-0 min-h-0 shrink-0 lg:shrink lg:flex-1 lg:min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4">
        {!activeSession && !loading && (
          <div role="status" className="mb-4 shrink-0 rounded-xl border border-rose-600/70 bg-rose-950/80 p-3 sm:p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Caixa fechado</p>
                  <p className="mt-1 text-xs leading-relaxed text-rose-100">Abra o caixa com o fundo de troco para começar a vender.</p>
                </div>
              </div>
              <Link to="/app/cash" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300">
                Abrir caixa agora
              </Link>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Pesquisar por nome, SKU ou passe o código de barras no leitor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
            />
          </div>
          <div 
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 rounded-xl border border-slate-700 text-xs text-slate-300"
            title="Leitor de código de barras USB ativo (emulação de teclado)"
          >
            <Barcode className="w-4 h-4 text-emerald-400" />
            <span>Leitor USB Pronto</span>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 scrollbar-none shrink-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[36px] ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Todos os Itens
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[36px] ${
                selectedCategory === c.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="max-h-[min(35dvh,260px)] overflow-y-auto pr-1 lg:max-h-none lg:flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Carregando catálogo...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
              <Tag className="w-8 h-8 mb-2 opacity-50" />
              <p>Nenhum produto encontrado com os filtros atuais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const effectivePrice = (p.promo_price_cents && p.promo_price_cents > 0)
                  ? p.promo_price_cents
                  : p.price_cents;
                const hasPromo = p.promo_price_cents && p.promo_price_cents > 0;

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="p-3 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all flex flex-col justify-between group cursor-pointer min-h-[105px]"
                  >
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block truncate">
                        {p.sku}
                      </span>
                      <h4 className="text-xs font-semibold text-white group-hover:text-emerald-400 line-clamp-2 mt-0.5 leading-tight">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                      <div>
                        {hasPromo && (
                          <span className="text-[10px] text-slate-500 line-through block">
                            {formatCentsToBRL(p.price_cents)}
                          </span>
                        )}
                        <span className="text-sm font-black text-emerald-400">
                          {formatCentsToBRL(effectivePrice)}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {p.unit}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lado Direito: Carrinho de Compras & Checkout */}
      <div className="w-full lg:w-96 min-w-0 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shrink-0">
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Carrinho ({cart.reduce((a, b) => a + b.quantity, 0)})</h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm text-center py-8">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
              <p>Carrinho vazio</p>
              <p className="text-xs text-slate-600 mt-1">
                Toque nos itens ou utilize o leitor USB para adicionar
              </p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div
                key={item.productId}
                className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white truncate">{item.name}</p>
                  <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                    {formatCentsToBRL(item.unitPriceCents)} cada
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => updateQuantity(index, -1)}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center cursor-pointer min-h-[32px] min-w-[32px]"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-sm w-6 text-center text-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(index, 1)}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center cursor-pointer min-h-[32px] min-w-[32px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeFromCart(index)}
                    className="w-7 h-7 rounded-lg text-rose-400 hover:bg-rose-500/20 flex items-center justify-center ml-1 cursor-pointer min-h-[32px] min-w-[32px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-850 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-800 rounded-lg border border-slate-700 px-2 py-1">
              <Percent className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <input
                type="number"
                placeholder="Desconto"
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setDiscountType(discountType === 'percent' ? 'cents' : 'percent')}
                className="text-[10px] font-bold text-emerald-400 uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer"
              >
                {discountType === 'percent' ? '%' : 'R$'}
              </button>
            </div>
            <span className="text-[10px] text-slate-400" title={`Alçada de desconto: até ${maxDiscountAllowedPercent}%`}>
              (Máx {maxDiscountAllowedPercent}%)
            </span>
          </div>

          <div className="space-y-1 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatCentsToBRL(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Desconto concedido:</span>
                <span className="font-semibold">-{formatCentsToBRL(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-white pt-1 border-t border-slate-700">
              <span>TOTAL A COBRAR:</span>
              <span className="text-emerald-400 text-lg">{formatCentsToBRL(totalCents)}</span>
            </div>
          </div>

          <Button
            size="lg"
            disabled={cart.length === 0 || !activeSession}
            onClick={() => setIsPaymentOpen(true)}
            className="w-full gap-2 font-black text-base min-h-[50px] shadow-lg shadow-emerald-950/60"
          >
            <CreditCard className="w-5 h-5" />
            <span>Receber / Cobrar ({formatCentsToBRL(totalCents)})</span>
          </Button>
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        subtotalCents={subtotalCents}
        discountCents={discountCents}
        totalCents={totalCents}
        userRole={currentUser?.role || 'cashier'}
        onConfirmPayment={handleConfirmSale}
        isLoading={isProcessingSale}
      />

      {completedSale && (
        <ReceiptModal
          isOpen={!!completedSale}
          onClose={() => setCompletedSale(null)}
          sale={completedSale.sale}
          items={completedSale.items}
          payments={completedSale.payments}
          storeName={currentStore?.name}
          storeDocument={currentTenant?.document}
          storeAddress={currentStore?.address}
        />
      )}
    </div>
  );
};
