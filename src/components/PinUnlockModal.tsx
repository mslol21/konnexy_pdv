import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { DEMO_TENANT_ID } from '../lib/db/seed';

export const PinUnlockModal: React.FC = () => {
  const { isPinLocked, unlockWithPin, currentUser, currentTenant, pinBlockedUntil } = useAuthStore();
  const demo = currentTenant?.id === DEMO_TENANT_ID;
  const pinLength = demo ? 4 : 6;
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isPinLocked) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < pinLength) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      if (nextPin.length === pinLength) {
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
        <div className="w-14 h-14 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Terminal Bloqueado</h2>
        <p className="text-xs text-slate-400 mb-6">
          Operador atual: <strong className="text-slate-200">{currentUser?.name || 'Operador'}</strong>
          <br />{demo ? 'Digite seu PIN de 4 dígitos para continuar' : 'Digite seu PIN de 6 dígitos para continuar'}
        </p>

        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: pinLength }, (_, index) => index).map((index) => (
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
            {pinBlockedUntil > Date.now() ? 'Muitas tentativas. Aguarde 5 minutos.' : demo ? 'PIN incorreto. Use 1234 / 0000 (demo).' : 'PIN incorreto. Tente novamente.'}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
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
      </div>
    </div>
  );
};
