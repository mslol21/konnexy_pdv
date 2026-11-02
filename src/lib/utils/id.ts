/**
 * Utilitário para geração de identificadores universais UUIDv4 seguros para operações offline.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 para ambientes legados ou testes
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Cria ou recupera o identificador exclusivo deste terminal/dispositivo físico.
 */
export function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'konnexy_pdv_device_id';
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId) {
      deviceId = `dev-${generateUUID().substring(0, 8)}`;
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'dev-browser-temp';
  }
}
