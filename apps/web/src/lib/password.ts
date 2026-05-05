import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

const LEGACY_PREFIX = 'legacy_scrypt:';

/**
 * Hash a password using bcrypt (cost factor 12).
 * This is the unified hash format used across both web app and workflow-engine.
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

/**
 * Verify a password against a stored hash.
 * Supports both:
 *   - bcrypt hashes (new, from both web app and workflow-engine)
 *   - legacy scrypt hashes (format: `hex(salt):hex(key)`)
 *
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  // Try bcrypt first (workflow-engine uses $2a$ or $2b$ prefix)
  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(password, storedHash);
  }

  // Try legacy scrypt (hex(salt):hex(key))
  const parts = storedHash.split(':');
  if (parts.length === 2) {
    const [salt, key] = parts;
    if (salt && key) {
      try {
        const derivedKey = scryptSync(password, salt, 64);
        const storedKey = Buffer.from(key, 'hex');
        if (derivedKey.length === storedKey.length) {
          return timingSafeEqual(derivedKey, storedKey);
        }
      } catch {
        return false;
      }
    }
  }

  return false;
}
