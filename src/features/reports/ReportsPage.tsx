import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Printer, 
  CreditCard, 
  Package, 
  User
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  getProductSalesReport, 
  getPaymentMethodReport, 
  getCashierSalesReport,
  type ProductSalesReportItem,
  type PaymentMethodReportItem,
  type CashierSalesReportItem
} from '../../lib/services/reportsService';
import { formatCentsToBRL } from '../../lib/utils/currency';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export const ReportsPage: React.FC = () => {
  const { currentTenant, currentStore } = useAuthStore();
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [activeReport, setActiveReport] = useState<'products' | 'payments' | 'cashiers'>('products');
  const [productReports, setProductReports] = useState<ProductSalesReportItem[]>([]);
  const [paymentReports, setPaymentReports] = useState<PaymentMethodReportItem[]>([]);
  const [cashierReports, setCashierReports] = useState<CashierSalesReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getDates = useCallback(() => {
    const now = new Date();
    if (period === 'all') return { start: undefined, end: undefined };

    let start = new Date();
    if (period === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (period === '7days') {
      start.setDate(now.getDate() - 7);
    } else if (period === '30days') {
      start.setDate(now.getDate() - 30);
    }

    return {
      start: start.toISOString(),
      end: now.toISOString()
    };
  }, [period]);

  const loadReports = useCallback(async () => {
    if (!currentTenant || !currentStore) return;
    setLoading(true);
    const { start, end } = getDates();

    try {
      const [prods, pays, cashiers] = await Promise.all([
        getProductSalesReport(currentTenant.id, currentStore.id, start, end),
        getPaymentMethodReport(currentTenant.id, currentStore.id, start, end),
        getCashierSalesReport(currentTenant.id, currentStore.id, start, end)
      ]);

      setProductReports(prods);
      setPaymentReports(pays);
      setCashierReports(cashiers);
    } catch (err) {
      console.error('Erro ao gerar relatórios:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, currentStore, getDates]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExportCSV = () => {
    let csv = '';
    if (activeReport === 'products') {
      csv = 'Produto;SKU;Qtd_Vendida;Faturamento_Bruto;Custo_CMV;Margem_Bruta\n';
      csv += productReports
        .map((p) => `"${p.productName}";"${p.sku}";${p.quantitySold};${p.totalGrossCents/100};${p.totalCostCents/100};${p.estimatedMarginCents/100}`)
        .join('\n');
    } else if (activeReport === 'payments') {
      csv = 'Metodo;Qtd_Vendas;Total_Faturado;Participacao_Percent\n';
      csv += paymentReports
        .map((p) => `"${p.method}";${p.salesCount};${p.totalCents/100};${p.percentage}%`)
        .join('\n');
    } else {
      csv = 'Operador;Qtd_Vendas;Total_Faturado;Ticket_Medio\n';
      csv += cashierReports
        .map((c) => `"${c.userName}";${c.salesCount};${c.totalCents/100};${c.averageTicketCents/100}`)
        .join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${activeReport}-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Relatórios Gerenciais de Vendas & Margem
          </h2>
          <p className="text-sm text-slate-400">
            Desempenho por produto, meio de pagamento e operador em tempo real
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} variant="secondary" size="sm" className="gap-1.5">
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </Button>

          <Button onClick={handleExportCSV} variant="secondary" size="sm" className="gap-1.5">
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtro de Período */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-300">Período:</span>
          {(['today', '7days', '30days', 'all'] as const).map((p) => {
            const labels = { today: 'Hoje', '7days': 'Últimos 7 dias', '30days': 'Últimos 30 dias', all: 'Histórico Completo' };
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  period === p ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seleção do Tipo de Relatório */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setActiveReport('products')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeReport === 'products'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Vendas por Produto & Margem</span>
        </button>
        <button
          onClick={() => setActiveReport('payments')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeReport === 'payments'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Meios de Pagamento</span>
        </button>
        <button
          onClick={() => setActiveReport('cashiers')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeReport === 'cashiers'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Desempenho por Operador</span>
        </button>
      </div>

      {/* Conteúdo: Relatório por Produto */}
      {activeReport === 'products' && (
        <Card className="p-0 overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4 text-center">Qtd. Vendida</th>
                  <th className="py-3 px-4 text-right">Faturamento Bruto</th>
                  <th className="py-3 px-4 text-right">Custo (CMV)</th>
                  <th className="py-3 px-4 text-right">Margem Bruta Estimada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Calculando métricas...
                    </td>
                  </tr>
                ) : productReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Nenhuma venda de produto registrada no período selecionado.
                    </td>
                  </tr>
                ) : (
                  productReports.map((p) => (
                    <tr key={p.productId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-white">{p.productName}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{p.sku}</td>
                      <td className="py-3 px-4 text-center font-bold text-white">{p.quantitySold}</td>
                      <td className="py-3 px-4 text-right font-semibold text-white">
                        {formatCentsToBRL(p.totalGrossCents)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400">
                        {formatCentsToBRL(p.totalCostCents)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400">
                        {formatCentsToBRL(p.estimatedMarginCents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Conteúdo: Relatório por Forma de Pagamento */}
      {activeReport === 'payments' && (
        <Card className="p-0 overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Método de Pagamento</th>
                  <th className="py-3 px-4 text-center">Transações</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Participação (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {paymentReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Nenhum pagamento registrado no período.
                    </td>
                  </tr>
                ) : (
                  paymentReports.map((p) => {
                    const methodLabels: Record<string, string> = {
                      money: 'Dinheiro',
                      pix: 'PIX',
                      debit_card: 'Cartão de Débito',
                      credit_card: 'Cartão de Crédito',
                      voucher: 'Voucher',
                      other: 'Outros'
                    };

                    return (
                      <tr key={p.method} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-white">
                          {methodLabels[p.method] || p.method}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-white">{p.salesCount}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-400">
                          {formatCentsToBRL(p.totalCents)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                            {p.percentage}%
                          </span>
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

      {/* Conteúdo: Relatório por Operador */}
      {activeReport === 'cashiers' && (
        <Card className="p-0 overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Operador / Vendedor</th>
                  <th className="py-3 px-4 text-center">Atendimentos / Vendas</th>
                  <th className="py-3 px-4 text-right">Faturamento Total</th>
                  <th className="py-3 px-4 text-right">Ticket Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {cashierReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Nenhuma venda por operador no período.
                    </td>
                  </tr>
                ) : (
                  cashierReports.map((c) => (
                    <tr key={c.userId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white">{c.userName}</td>
                      <td className="py-3 px-4 text-center font-semibold text-white">{c.salesCount}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400">
                        {formatCentsToBRL(c.totalCents)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-sky-400">
                        {formatCentsToBRL(c.averageTicketCents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
