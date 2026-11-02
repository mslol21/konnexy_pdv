import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  Package, 
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import { useAuthStore } from '../../store/useAuthStore';
import { formatCentsToBRL } from '../../lib/utils/currency';
import { formatTimeBR } from '../../lib/utils/date';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { Sale, Product, CashSession } from '../../types/database';

export const DashboardPage: React.FC = () => {
  const { currentTenant, currentStore } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [totalSalesCents, setTotalSalesCents] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [cashBalanceCents, setCashBalanceCents] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      if (!currentTenant || !currentStore) return;
      setLoading(true);

      try {
        const sales = await db.sales
          .where('[tenant_id+store_id]')
          .equals([currentTenant.id, currentStore.id])
          .reverse()
          .sortBy('created_at');

        setRecentSales(sales.slice(0, 5));

        const completedSales = sales.filter((s) => s.status === 'completed');
        const totalCents = completedSales.reduce((acc, s) => acc + s.total_cents, 0);
        setTotalSalesCents(totalCents);
        setSalesCount(completedSales.length);

        const session = await db.cash_sessions
          .where('[tenant_id+store_id]')
          .equals([currentTenant.id, currentStore.id])
          .and((s) => s.status === 'open')
          .first();

        setActiveSession(session || null);
        if (session) {
          const cashMovements = await db.cash_movements
            .where('cash_session_id')
            .equals(session.id)
            .toArray();

          const movementsSum = cashMovements.reduce((acc, m) => {
            if (m.type === 'supply' || m.type === 'sale') return acc + m.amount_cents;
            if (m.type === 'bleed' || m.type === 'refund') return acc - m.amount_cents;
            return acc;
          }, 0);

          setCashBalanceCents(session.initial_amount_cents + movementsSum);
        } else {
          setCashBalanceCents(0);
        }

        const balances = await db.inventory_balances
          .where('[tenant_id+store_id]')
          .equals([currentTenant.id, currentStore.id])
          .toArray();

        const allProducts = await db.products
          .where('[tenant_id+store_id]')
          .equals([currentTenant.id, currentStore.id])
          .toArray();

        const lowStockList: Product[] = [];
        for (const prod of allProducts) {
          const balance = balances.find((b) => b.product_id === prod.id);
          const currentQty = balance ? balance.current_stock : 0;
          if (currentQty <= prod.min_stock) {
            lowStockList.push(prod);
          }
        }
        setLowStockProducts(lowStockList);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [currentTenant, currentStore]);

  const ticketMedioCents = salesCount > 0 ? Math.round(totalSalesCents / salesCount) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 flex items-center gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent" />
          <span>Carregando métricas locais...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Painel de Operações</h2>
          <p className="text-sm text-slate-400">
            Resumo em tempo real processado localmente no terminal
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/pdv">
            <Button size="lg" className="gap-2 shadow-lg shadow-emerald-950/40">
              <ShoppingBag className="w-5 h-5" />
              <span>Abrir Balcão de Vendas (PDV)</span>
            </Button>
          </Link>
        </div>
      </div>

      {!activeSession && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300">Caixa Fechado</p>
              <p className="text-xs text-slate-300">
                Abra uma sessão de caixa com fundo de troco para autorizar novas vendas no balcão.
              </p>
            </div>
          </div>
          <Link to="/cash">
            <Button size="sm" variant="outline" className="text-amber-300 border-amber-500/50 hover:bg-amber-950/30">
              Abrir Caixa
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Faturamento Total</span>
            <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-white">
              {formatCentsToBRL(totalSalesCents)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">{salesCount} vendas</span> registradas
            </p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Ticket Médio</span>
            <div className="p-2 bg-sky-500/15 text-sky-400 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-white">
              {formatCentsToBRL(ticketMedioCents)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Por cliente atendido</p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo em Caixa</span>
            <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-white">
              {formatCentsToBRL(cashBalanceCents)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              Status:{' '}
              {activeSession ? (
                <span className="text-emerald-400 font-semibold">Sessão Aberta</span>
              ) : (
                <span className="text-amber-400 font-semibold">Fechado</span>
              )}
            </p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Estoque em Alerta</span>
            <div className="p-2 bg-amber-500/15 text-amber-400 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-white">
              {lowStockProducts.length}
            </div>
            <p className="text-xs text-amber-400 mt-1">Produtos no mínimo ou zerados</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              Últimas Vendas Realizadas
            </h3>
            <Link to="/pdv" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
              Ver balcão <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Nenhuma venda registrada ainda neste terminal.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentSales.map((sale) => (
                <div key={sale.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Venda #{sale.sale_number}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatTimeBR(sale.created_at)} • {sale.user_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      {formatCentsToBRL(sale.total_cents)}
                    </p>
                    <Badge variant={sale.sync_status === 'synced' ? 'success' : 'warning'}>
                      {sale.sync_status === 'synced' ? 'Nuvem' : 'Local'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              Atenção: Estoque Baixo
            </h3>
            <Link to="/inventory" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
              Ajustar estoque <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Todos os produtos estão com níveis saudáveis de estoque.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {lowStockProducts.slice(0, 5).map((prod) => (
                <div key={prod.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{prod.name}</p>
                    <p className="text-xs text-slate-400">
                      SKU: {prod.sku} • Mínimo exigido: {prod.min_stock} {prod.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                      Repor Estoque
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
