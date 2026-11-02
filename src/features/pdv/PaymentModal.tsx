import React, { useState } from 'react';
import { 
  X, 
  DollarSign, 
  QrCode, 
  CreditCard, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatCentsToBRL, parseBRLToCents, calculateChange } from '../../lib/utils/currency';
import type { PaymentMethod } from '../../types/database';

export interface PaymentItem {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  receivedCents: number;
  changeCents: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  userRole: string;
  onConfirmPayment: (payments: PaymentItem[]) => Promise<void>;
  isLoading: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalCents,
  onConfirmPayment,
  isLoading
}) => {
  if (!isOpen) return null;

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('money');
  const [inputVal, setInputVal] = useState<string>('');
  const [receivedVal, setReceivedVal] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const totalPaidCents = payments.reduce((acc, p) => acc + p.amountCents, 0);
  const remainingCents = Math.max(0, totalCents - totalPaidCents);

  const handleAddPayment = () => {
    setError(null);
    let amount = inputVal ? parseBRLToCents(inputVal) : remainingCents;
    if (amount <= 0) {
      setError('Informe um valor válido.');
      return;
    }

    if (amount > remainingCents) {
      amount = remainingCents;
    }

    let received = amount;
    let change = 0;

    if (selectedMethod === 'money') {
      const parsedReceived = receivedVal ? parseBRLToCents(receivedVal) : amount;
      received = Math.max(amount, parsedReceived);
      change = calculateChange(amount, received);
    }

    const newPayment: PaymentItem = {
      id: Math.random().toString(36).substring(2, 9),
      method: selectedMethod,
      amountCents: amount,
      receivedCents: received,
      changeCents: change
    };

    setPayments([...payments, newPayment]);
    setInputVal('');
    setReceivedVal('');
  };

  const handleRemovePayment = (id: string) => {
    setPayments(payments.filter((p) => p.id !== id));
  };

  const handleConfirm = async () => {
    if (totalPaidCents < totalCents) {
      setError(`Ainda restam ${formatCentsToBRL(remainingCents)} a serem pagos.`);
      return;
    }
    await onConfirmPayment(payments);
  };

  const methodOptions: { method: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { method: 'money', label: 'Dinheiro', icon: DollarSign },
    { method: 'pix', label: 'PIX (QR Code)', icon: QrCode },
    { method: 'debit_card', label: 'Cartão de Débito', icon: CreditCard },
    { method: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base">Recebimento da Venda</h3>
            <p className="text-xs text-slate-400">
              Total da Venda: <strong className="text-emerald-400 text-sm">{formatCentsToBRL(totalCents)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Status de Pagamento */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
            <div>
              <p className="text-xs text-slate-400">Total Pago</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{formatCentsToBRL(totalPaidCents)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Restante a Pagar</p>
              <p className={`text-lg font-bold mt-0.5 ${remainingCents > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {formatCentsToBRL(remainingCents)}
              </p>
            </div>
          </div>

          {/* Seletor de Métodos */}
          {remainingCents > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                1. Escolha a Forma de Pagamento
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {methodOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedMethod === opt.method;
                  return (
                    <button
                      key={opt.method}
                      type="button"
                      onClick={() => setSelectedMethod(opt.method)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[56px] ${
                        isSelected
                          ? 'bg-emerald-600/20 border-emerald-500 text-white font-bold'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Inserção de valor e cálculo de troco */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Valor a Lançar:
                  </label>
                  <Input
                    placeholder={formatCentsToBRL(remainingCents)}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-500">Deixe em branco para o saldo restante</span>
                </div>

                {selectedMethod === 'money' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Valor Entregue pelo Cliente:
                    </label>
                    <Input
                      placeholder="Ex: 50,00"
                      value={receivedVal}
                      onChange={(e) => setReceivedVal(e.target.value)}
                    />
                    <span className="text-[10px] text-slate-500">Para cálculo automático de troco</span>
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={handleAddPayment}
                variant="secondary"
                className="w-full gap-2 min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Pagamento</span>
              </Button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Lista de Pagamentos Adicionados */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Pagamentos Registrados ({payments.length})
            </label>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-800 rounded-xl">
                Nenhum pagamento inserido. Adicione o método acima.
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-semibold text-white capitalize">{p.method.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-400">
                        {formatCentsToBRL(p.amountCents)}
                        {p.changeCents > 0 && (
                          <span className="text-emerald-400 ml-2 font-bold">
                            (Troco: {formatCentsToBRL(p.changeCents)})
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemovePayment(p.id)}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Remover este pagamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={remainingCents > 0 || payments.length === 0 || isLoading}
            isLoading={isLoading}
            className="gap-2 min-h-[48px] px-6 font-bold"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Concluir Venda ({formatCentsToBRL(totalCents)})</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
