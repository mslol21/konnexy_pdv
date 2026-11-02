import React, { useState, useEffect, useCallback } from 'react';
import { 
  Banknote, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  History, 
  Plus, 
  Minus,
  CheckCircle2
} from 'lucide-react';
import { db } from '../../lib/db';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  openCashSession, 
  closeCashSession, 
  addCashMovement, 
  getActiveCashSession 
} from '../../lib/services/cashService';
import { formatCentsToBRL, parseBRLToCents } from '../../lib/utils/currency';
import { formatDateTimeBR } from '../../lib/utils/date';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { CashSession, CashMovement } from '../../types/database';

export const CashPage: React.FC = () => {
  const { currentTenant, currentStore, currentUser, deviceId } = useAuthStore();
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [previousSessions, setPreviousSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de modais e formulários
  const [openModalType, setOpenModalType] = useState<'open' | 'supply' | 'bleed' | 'close' | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTenant || !currentStore) return;
    setLoading(true);
    try {
      const session = await getActiveCashSession(currentTenant.id, currentStore.id, deviceId);
      setActiveSession(session);

      if (session) {
        const movs = await db.cash_movements
          .where('cash_session_id')
          .equals(session.id)
          .reverse()
          .sortBy('created_at');
        setMovements(movs);
      } else {
        setMovements([]);
      }

      // Sessões anteriores fechadas
      const closed = await db.cash_sessions
        .where('[tenant_id+store_id]')
        .equals([currentTenant.id, currentStore.id])
        .and((s) => s.status === 'closed')
        .reverse()
        .sortBy('closed_at');

      setPreviousSessions(closed.slice(0, 10));
    } catch (err) {
      console.error('Erro ao carregar dados do caixa:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, currentStore, deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cálculo do saldo atual em dinheiro
  const currentCashBalanceCents = React.useMemo(() => {
    if (!activeSession) return 0;
    const movsSum = movements.reduce((acc, m) => {
      if (m.payment_method === 'money') {
        if (m.type === 'opening' || m.type === 'supply' || m.type === 'sale') return acc + m.amount_cents;
        if (m.type === 'bleed' || m.type === 'refund') return acc - m.amount_cents;
      }
      return acc;
    }, 0);
    return movsSum;
  }, [activeSession, movements]);

  const handleOpenCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !currentStore || !currentUser) return;
    setError(null);
    setSubmitting(true);
    try {
      const initialCents = parseBRLToCents(amountInput);
      await openCashSession({
        tenantId: currentTenant.id,
        storeId: currentStore.id,
        deviceId,
        userId: currentUser.id,
        userName: currentUser.name,
        initialAmountCents: initialCents,
        notes: notesInput || undefined
      });
      setOpenModalType(null);
      setAmountInput('');
      setNotesInput('');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCashMovement = async (type: 'supply' | 'bleed') => {
    if (!currentTenant || !currentStore || !currentUser || !activeSession) return;
    setError(null);
    const amountCents = parseBRLToCents(amountInput);
    if (amountCents <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    if (!reasonInput.trim()) {
      setError('Informe o motivo da movimentação.');
      return;
    }

    setSubmitting(true);
    try {
      await addCashMovement({
        cashSessionId: activeSession.id,
        tenantId: currentTenant.id,
        storeId: currentStore.id,
        deviceId,
        userId: currentUser.id,
        userName: currentUser.name,
        type,
        amountCents,
        reason: reasonInput.trim()
      });
      setOpenModalType(null);
      setAmountInput('');
      setReasonInput('');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !currentStore || !currentUser || !activeSession) return;
    setError(null);
    setSubmitting(true);
    try {
      const finalCents = parseBRLToCents(amountInput);
      await closeCashSession({
        cashSessionId: activeSession.id,
        tenantId: currentTenant.id,
        storeId: currentStore.id,
        deviceId,
        userId: currentUser.id,
        userName: currentUser.name,
        finalAmountCents: finalCents,
        notes: notesInput || undefined
      });
      setOpenModalType(null);
      setAmountInput('');
      setNotesInput('');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Carregando informações do caixa...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-400" />
            Controle de Sessão de Caixa
          </h2>
          <p className="text-sm text-slate-400">
            Abertura, sangrias, suprimentos, conferência cega e fechamento auditado
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!activeSession ? (
            <Button
              onClick={() => {
                setError(null);
                setAmountInput('100,00');
                setOpenModalType('open');
              }}
              variant="primary"
              className="gap-2 font-bold shadow-lg shadow-emerald-950/50"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Novo Caixa</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setError(null);
                  setAmountInput('');
                  setReasonInput('');
                  setOpenModalType('supply');
                }}
                variant="secondary"
                size="sm"
                className="gap-1.5"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Suprimento</span>
              </Button>

              <Button
                onClick={() => {
                  setError(null);
                  setAmountInput('');
                  setReasonInput('');
                  setOpenModalType('bleed');
                }}
                variant="secondary"
                size="sm"
                className="gap-1.5"
              >
                <Minus className="w-4 h-4 text-rose-400" />
                <span>Sangria</span>
              </Button>

              <Button
                onClick={() => {
                  setError(null);
                  setAmountInput('');
                  setOpenModalType('close');
                }}
                variant="danger"
                size="sm"
                className="gap-1.5"
              >
                <Lock className="w-4 h-4" />
                <span>Fechar Caixa</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {activeSession ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Saldo em Gaveta (Dinheiro Físico)
            </span>
            <div className="mt-3">
              <p className="text-3xl font-black text-emerald-400">
                {formatCentsToBRL(currentCashBalanceCents)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Calculado a partir de vendas e movimentações</p>
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Fundo Inicial (Abertura)
            </span>
            <div className="mt-3">
              <p className="text-2xl font-bold text-white">
                {formatCentsToBRL(activeSession.initial_amount_cents)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Aberto às {formatDateTimeBR(activeSession.opened_at)}
              </p>
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Operador Responsável
            </span>
            <div className="mt-3">
              <p className="text-lg font-bold text-white">{activeSession.opened_by_user_name}</p>
              <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 inline" /> Sessão Ativa • Terminal: {deviceId}
              </p>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="text-center py-8 bg-amber-500/5 border-amber-500/30">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white">Nenhum caixa aberto neste terminal</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
            Para realizar vendas e receber pagamentos, realize a abertura do caixa informando o valor do fundo de troco inicial.
          </p>
          <Button
            onClick={() => {
              setError(null);
              setAmountInput('100,00');
              setOpenModalType('open');
            }}
            variant="primary"
          >
            Abrir Caixa Agora
          </Button>
        </Card>
      )}

      {activeSession && (
        <Card className="space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            Movimentações da Sessão Atual ({movements.length})
          </h3>

          {movements.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Nenhuma movimentação registrada nesta sessão ainda.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {movements.map((m) => {
                const isPositive = m.type === 'opening' || m.type === 'supply' || m.type === 'sale';
                const typeLabels: Record<string, string> = {
                  opening: 'Abertura de Caixa',
                  supply: 'Suprimento (Reforço)',
                  bleed: 'Sangria (Retirada)',
                  sale: 'Venda em Dinheiro',
                  refund: 'Estorno de Venda'
                };

                return (
                  <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {typeLabels[m.type] || m.type}
                      </p>
                      <p className="text-slate-400 mt-0.5">
                        {formatDateTimeBR(m.created_at)} • Operador: {m.user_name}
                      </p>
                      {m.reason && <p className="text-slate-400 italic">Motivo: {m.reason}</p>}
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-black ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive ? '+' : '-'}{formatCentsToBRL(m.amount_cents)}
                      </p>
                      <span className="text-[10px] text-slate-400 uppercase">
                        {m.payment_method}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          Sessões de Caixa Fechadas Anteriores
        </h3>

        {previousSessions.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Nenhuma sessão anterior arquivada neste terminal.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {previousSessions.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-white text-sm">
                    Caixa encerrado em {formatDateTimeBR(s.closed_at || s.opened_at)}
                  </p>
                  <p className="text-slate-400">
                    Aberto por {s.opened_by_user_name} • Fechado por {s.closed_by_user_name || '-'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">
                    Declarado: {formatCentsToBRL(s.final_amount_cents || 0)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Esperado: {formatCentsToBRL(s.expected_amount_cents || 0)}
                  </p>
                  {s.difference_cents !== undefined && s.difference_cents !== 0 && (
                    <Badge variant={s.difference_cents > 0 ? 'info' : 'danger'}>
                      {s.difference_cents > 0 ? 'Sobra' : 'Quebra'}: {formatCentsToBRL(Math.abs(s.difference_cents))}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {openModalType && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              {openModalType === 'open' && 'Abertura de Caixa'}
              {openModalType === 'supply' && 'Suprimento de Caixa (Reforço)'}
              {openModalType === 'bleed' && 'Sangria de Caixa (Retirada)'}
              {openModalType === 'close' && 'Fechamento Cego de Caixa'}
            </h3>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                if (openModalType === 'open') handleOpenCash(e);
                else if (openModalType === 'close') handleCloseCash(e);
                else if (openModalType === 'supply') {
                  e.preventDefault();
                  handleCashMovement('supply');
                } else if (openModalType === 'bleed') {
                  e.preventDefault();
                  handleCashMovement('bleed');
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  {openModalType === 'open' && 'Valor do Fundo de Troco (R$)'}
                  {openModalType === 'supply' && 'Valor do Suprimento (R$)'}
                  {openModalType === 'bleed' && 'Valor da Sangria (R$)'}
                  {openModalType === 'close' && 'Valor Físico Contado em Gaveta (R$)'}
                </label>
                <Input
                  autoFocus
                  placeholder="0,00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  required
                />
              </div>

              {(openModalType === 'supply' || openModalType === 'bleed') && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Justificativa / Motivo
                  </label>
                  <Input
                    placeholder="Ex: Troco para balcão ou depósito bancário"
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    required
                  />
                </div>
              )}

              {(openModalType === 'open' || openModalType === 'close') && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Observações (Opcional)
                  </label>
                  <Input
                    placeholder="Observações da sessão..."
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpenModalType(null)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant={openModalType === 'bleed' || openModalType === 'close' ? 'danger' : 'primary'}
                  isLoading={submitting}
                >
                  Confirmar Operação
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
