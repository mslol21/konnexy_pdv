import React from 'react';
import { Printer, X, CheckCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { formatCentsToBRL } from '../lib/utils/currency';
import { formatDateTimeBR } from '../lib/utils/date';
import type { Sale, SaleItem, SalePayment } from '../types/database';

interface ReceiptModalProps {
  sale: Sale | null;
  items: SaleItem[];
  payments: SalePayment[];
  storeName?: string;
  storeDocument?: string;
  storeAddress?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  items,
  payments,
  storeName,
  storeDocument,
  storeAddress,
  isOpen,
  onClose
}) => {
  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const paymentLabels: Record<string, string> = {
    money: 'Dinheiro',
    pix: 'PIX',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    voucher: 'Vale/Voucher',
    other: 'Outros'
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Comprovante de Venda #{sale.sale_number}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-slate-950/60">
          <div
            id="thermal-receipt"
            className="bg-white text-slate-900 p-5 rounded-lg font-mono text-xs shadow-md leading-relaxed space-y-3"
          >
            <div className="text-center border-b border-dashed border-slate-400 pb-3">
              <p className="font-extrabold text-sm tracking-wider uppercase">
                {storeName || 'KONNEXY PDV'}
              </p>
              {storeDocument && <p className="text-[11px]">CNPJ/CPF: {storeDocument}</p>}
              {storeAddress && <p className="text-[10px] text-slate-600">{storeAddress}</p>}
              <div className="my-2 border-y border-dashed border-slate-800 py-1">
                <p className="font-black text-xs tracking-widest uppercase">
                  *** COMPROVANTE NÃO FISCAL ***
                </p>
                <p className="text-[10px]">NÃO É DOCUMENTO FISCAL • SEM VALOR TRIBUTÁRIO</p>
              </div>
              <p className="text-[11px]">
                Venda: <strong>#{sale.sale_number}</strong> • Emissão: {formatDateTimeBR(sale.created_at)}
              </p>
              <p className="text-[10px] text-slate-600">
                Operador: {sale.user_name} • Terminal: {sale.device_id}
              </p>
              {sale.customer_name && (
                <p className="text-[10px] text-slate-700 mt-1">
                  Cliente: {sale.customer_name} {sale.customer_document ? `(${sale.customer_document})` : ''}
                </p>
              )}
            </div>

            <div className="border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-300">
                <span>ITEM / DESCRIÇÃO</span>
                <span>TOTAL</span>
              </div>
              <div className="divide-y divide-slate-200 mt-1">
                {items.map((item, idx) => (
                  <div key={item.id || idx} className="py-1">
                    <div className="flex justify-between">
                      <span className="font-semibold truncate max-w-[200px]">
                        {idx + 1}. {item.product_name}
                      </span>
                      <span className="font-bold">{formatCentsToBRL(item.total_cents)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>
                        {item.quantity} un x {formatCentsToBRL(item.unit_price_cents)}
                      </span>
                      {item.discount_cents > 0 && (
                        <span className="text-rose-600 font-semibold">
                          Desc: -{formatCentsToBRL(item.discount_cents)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 text-xs border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCentsToBRL(sale.subtotal_cents)}</span>
              </div>
              {sale.discount_cents > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Desconto:</span>
                  <span>-{formatCentsToBRL(sale.discount_cents)}</span>
                </div>
              )}
              {sale.addition_cents > 0 && (
                <div className="flex justify-between">
                  <span>Acréscimo:</span>
                  <span>+{formatCentsToBRL(sale.addition_cents)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-400">
                <span>TOTAL A PAGAR:</span>
                <span>{formatCentsToBRL(sale.total_cents)}</span>
              </div>
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2">
              <span className="font-bold block">FORMA(S) DE PAGAMENTO:</span>
              {payments.map((p, idx) => (
                <div key={p.id || idx} className="flex justify-between">
                  <span>{paymentLabels[p.payment_method] || p.payment_method}:</span>
                  <span>{formatCentsToBRL(p.amount_cents)}</span>
                </div>
              ))}
              {payments.some((p) => p.change_cents > 0) && (
                <div className="flex justify-between font-bold text-emerald-700 pt-0.5">
                  <span>TROCO:</span>
                  <span>
                    {formatCentsToBRL(payments.reduce((acc, p) => acc + p.change_cents, 0))}
                  </span>
                </div>
              )}
            </div>

            <div className="text-center text-[9px] text-slate-500 pt-1 space-y-1">
              <p>Obrigado pela preferência!</p>
              <p>Konnexy PDV • Sistema de Balcão e Caixa Offline-First</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-850 border-t border-slate-800 flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="primary" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            <span>Imprimir Comprovante (58/80mm)</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
