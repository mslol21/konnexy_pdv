const encoder = new TextEncoder();
const ITERATIONS = 210_000;
function hex(bytes: Uint8Array): string { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
function unhex(value: string): Uint8Array { return new Uint8Array((value.match(/.{2}/g) ?? []).map(x => parseInt(x, 16))); }
async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
  return hex(new Uint8Array(bits));
}
export async function hashOperatorPin(pin: string): Promise<string> {
  if (!/^\d{6,8}$/.test(pin)) throw new Error('O PIN deve conter de 6 a 8 dígitos.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256:${ITERATIONS}:${hex(salt)}:${await derive(pin, salt)}`;
}
export async function verifyOperatorPin(pin: string, stored: string | undefined): Promise<boolean> {
  if (!stored || !/^\d{6,8}$/.test(pin)) return false;
  const match = /^pbkdf2-sha256:(\d+):([0-9a-f]{32}):([0-9a-f]{64})$/.exec(stored);
  if (!match || Number(match[1]) !== ITERATIONS) return false;
  const actual = unhex(await derive(pin, unhex(match[2])));
  const expected = unhex(match[3]);
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
