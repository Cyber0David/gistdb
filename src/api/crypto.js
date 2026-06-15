// AES-256-GCM encryption in the browser via Web Crypto API
// Key is derived from user's password — server never sees plaintext

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt);
  const enc  = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  // Pack: salt(16) + iv(12) + encrypted
  const combined = new Uint8Array(16 + 12 + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(encrypted), 28);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(ciphertext, password) {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const salt      = combined.subarray(0, 16);
  const iv        = combined.subarray(16, 28);
  const encrypted = combined.subarray(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

export function isEncrypted(content) {
  // Encrypted blobs are valid base64 and start with our marker length
  try { return atob(content).length > 28; } catch { return false; }
}
