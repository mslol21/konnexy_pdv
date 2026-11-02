import { useEffect, useRef } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
}

/**
 * Hook para interceptação de leitores de código de barras USB (emulação de teclado HID).
 * Detecta rajadas de digitação ultra-rápidas seguidas de Enter.
 */
export function useBarcodeScanner({
  onScan,
  minChars = 3,
  maxIntervalMs = 60
}: BarcodeScannerOptions): void {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o evento foi gerado com teclas de controle (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Se o intervalo entre teclas for muito longo, limpa o buffer (foi digitação humana manual)
      if (timeDiff > maxIntervalMs) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        if (barcode.length >= minChars) {
          e.preventDefault();
          e.stopPropagation();
          onScan(barcode);
        }
        bufferRef.current = '';
        return;
      }

      // Adiciona apenas caracteres imprimíveis
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, minChars, maxIntervalMs]);
}
