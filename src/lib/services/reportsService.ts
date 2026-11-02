import { db } from '../db';

export interface ProductSalesReportItem {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  totalGrossCents: number;
  totalCostCents: number;
  estimatedMarginCents: number;
}

export interface PaymentMethodReportItem {
  method: string;
  salesCount: number;
  totalCents: number;
  percentage: number;
}

export interface CashierSalesReportItem {
  userId: string;
  userName: string;
  salesCount: number;
  totalCents: number;
  averageTicketCents: number;
}

/**
 * Relatório de Vendas por Produto (Curva de mais vendidos e margens).
 */
export async function getProductSalesReport(
  tenantId: string, 
  storeId: string, 
  startDateIso?: string, 
  endDateIso?: string
): Promise<ProductSalesReportItem[]> {
  let salesQuery = db.sales
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((s) => s.status === 'completed');

  if (startDateIso && endDateIso) {
    salesQuery = salesQuery.and((s) => s.created_at >= startDateIso && s.created_at <= endDateIso);
  }

  const sales = await salesQuery.toArray();
  const productMap = new Map<string, ProductSalesReportItem>();

  for (const s of sales) {
    const items = await db.sale_items.where('sale_id').equals(s.id).toArray();
    for (const it of items) {
      const existing = productMap.get(it.product_id) || {
        productId: it.product_id,
        productName: it.product_name,
        sku: it.sku,
        quantitySold: 0,
        totalGrossCents: 0,
        totalCostCents: 0,
        estimatedMarginCents: 0
      };

      const costTotal = it.unit_cost_cents * it.quantity;
      existing.quantitySold += it.quantity;
      existing.totalGrossCents += it.total_cents;
      existing.totalCostCents += costTotal;
      existing.estimatedMarginCents += (it.total_cents - costTotal);

      productMap.set(it.product_id, existing);
    }
  }

  return Array.from(productMap.values()).sort((a, b) => b.totalGrossCents - a.totalGrossCents);
}

/**
 * Relatório de Vendas por Meio de Pagamento.
 */
export async function getPaymentMethodReport(
  tenantId: string, 
  storeId: string, 
  startDateIso?: string, 
  endDateIso?: string
): Promise<PaymentMethodReportItem[]> {
  let salesQuery = db.sales
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((s) => s.status === 'completed');

  if (startDateIso && endDateIso) {
    salesQuery = salesQuery.and((s) => s.created_at >= startDateIso && s.created_at <= endDateIso);
  }

  const sales = await salesQuery.toArray();
  const methodMap = new Map<string, { count: number; total: number }>();
  let overallTotal = 0;

  for (const s of sales) {
    const payments = await db.sale_payments.where('sale_id').equals(s.id).toArray();
    for (const p of payments) {
      const existing = methodMap.get(p.payment_method) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += p.amount_cents;
      overallTotal += p.amount_cents;
      methodMap.set(p.payment_method, existing);
    }
  }

  const result: PaymentMethodReportItem[] = [];
  methodMap.forEach((val, key) => {
    result.push({
      method: key,
      salesCount: val.count,
      totalCents: val.total,
      percentage: overallTotal > 0 ? Math.round((val.total / overallTotal) * 100) : 0
    });
  });

  return result.sort((a, b) => b.totalCents - a.totalCents);
}

/**
 * Relatório de Desempenho de Operadores / Caixas.
 */
export async function getCashierSalesReport(
  tenantId: string, 
  storeId: string, 
  startDateIso?: string, 
  endDateIso?: string
): Promise<CashierSalesReportItem[]> {
  let salesQuery = db.sales
    .where('[tenant_id+store_id]')
    .equals([tenantId, storeId])
    .and((s) => s.status === 'completed');

  if (startDateIso && endDateIso) {
    salesQuery = salesQuery.and((s) => s.created_at >= startDateIso && s.created_at <= endDateIso);
  }

  const sales = await salesQuery.toArray();
  const cashierMap = new Map<string, { name: string; count: number; total: number }>();

  for (const s of sales) {
    const existing = cashierMap.get(s.user_id) || { name: s.user_name, count: 0, total: 0 };
    existing.count += 1;
    existing.total += s.total_cents;
    cashierMap.set(s.user_id, existing);
  }

  const result: CashierSalesReportItem[] = [];
  cashierMap.forEach((val, id) => {
    result.push({
      userId: id,
      userName: val.name,
      salesCount: val.count,
      totalCents: val.total,
      averageTicketCents: val.count > 0 ? Math.round(val.total / val.count) : 0
    });
  });

  return result.sort((a, b) => b.totalCents - a.totalCents);
}
