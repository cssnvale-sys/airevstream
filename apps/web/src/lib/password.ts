import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Hash a password using scrypt with a random 16-byte salt.
 * Output format: `hex(salt):hex(derivedKey)`
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a stored hash (format: `hex(salt):hex(key)`).
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;
  const derivedKey = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(key, 'hex');
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}
