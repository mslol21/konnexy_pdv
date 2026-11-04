import React, { useState } from 'react';
import { Lock, Delete, X, Unlock, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { DEMO_TENANT_ID } from '../lib/db/seed';

export const PinUnlockModal: React.FC = () => {
  const { isPinLocked, unlockWithPin, unlockSession, currentUser, currentTenant, pinBlockedUntil, logout } = useAuthStore();
  const demo = currentTenant?.id === DEMO_TENANT_ID;
  const hasPinConfigured = Boolean(currentUser?.pin_hash);
  const targetPinLength = demo ? 4 : (currentUser?.pin_hash && currentUser.pin_hash.length <= 4 ? 4 : 6);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isPinLocked) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      // Auto-verifica quando atinge o tamanho esperado
      if (nextPin.length === targetPinLength || nextPin.length === 6) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const verifyPin = async (pinToTest: string) => {
    const success = await unlockWithPin(pinToTest);
    if (!success) {
      setError(true);
      setPin('');
    }
  };

  const handleDismissOrUnlock = () => {
    unlockSession();
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative">
        {/* Botão de Fechar no topo */}
        <button
          onClick={handleDismissOrUnlock}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Fechar tela de bloqueio"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Terminal Bloqueado</h2>
        <p className="text-xs text-slate-400 mb-4">
          Operador atual: <strong className="text-slate-200">{currentUser?.name || 'Operador'}</strong>
          <br />
          {hasPinConfigured
            ? (demo ? 'Digite seu PIN de 4 dígitos para continuar' : `Digite seu PIN de ${targetPinLength} dígitos para continuar`)
            : 'Nenhum PIN foi configurado para este operador.'}
        </p>

        {!hasPinConfigured ? (
          <div className="space-y-4 my-6">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
              Você já está autenticado com sua conta. Você pode desbloquear o terminal diretamente ou configurar um PIN em Configurações.
            </div>

            <button
              onClick={handleDismissOrUnlock}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Unlock className="w-4 h-4" />
              <span>Desbloquear Terminal Agora</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-2.5 mb-6">
              {Array.from({ length: targetPinLength }, (_, index) => index).map((index) => (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pin.length > index
                      ? 'bg-emerald-500 border-emerald-400 scale-110'
                      : 'bg-slate-800 border-slate-700'
                  } ${error ? 'bg-rose-500 border-rose-400 animate-shake' : ''}`}
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-semibold mb-4">
                {pinBlockedUntil > Date.now()
                  ? 'Muitas tentativas. Aguarde 5 minutos.'
                  : demo
                  ? 'PIN incorreto. Use 1234 / 0000 (demo).'
                  : 'PIN incorreto. Tente novamente ou desbloqueie abaixo.'}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleDigit(digit)}
                  className="h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-emerald-700 text-white font-bold text-xl transition-colors min-h-[48px] cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => setPin('')}
                className="h-14 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 text-xs font-semibold uppercase min-h-[48px] cursor-pointer"
              >
                Limpar
              </button>
              <button
                onClick={() => handleDigit('0')}
                className="h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-emerald-700 text-white font-bold text-xl transition-colors min-h-[48px] cursor-pointer"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                className="h-14 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-300 flex items-center justify-center min-h-[48px] cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {/* Rodapé com ações de contingência */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col gap-2">
          {hasPinConfigured && (
            <button
              type="button"
              onClick={handleDismissOrUnlock}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Desbloquear Terminal (Ignorar PIN)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da conta / Entrar com outro e-mail</span>
          </button>
        </div>
      </div>
    </div>
  );
};
