// SHA-256 hashing via Web Crypto API (built into all modern browsers)
export async function hashPassword(password) {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPassword(input, storedHash) {
  if (!storedHash) return true; // no password set
  const inputHash = await hashPassword(input);
  return inputHash === storedHash;
}

// Detect if a stored value is already a SHA-256 hash (64 hex chars)
export function isHashed(value) {
  return /^[a-f0-9]{64}$/.test(value);
}
