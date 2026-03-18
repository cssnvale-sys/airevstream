import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/password';

describe('password', () => {
  describe('hashPassword', () => {
    it('returns a salt:key formatted string', () => {
      const hash = hashPassword('test-password');
      const parts = hash.split(':');
      expect(parts).toHaveLength(2);
      // Salt is 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32);
      // Derived key is 64 bytes = 128 hex chars
      expect(parts[1]).toHaveLength(128);
    });

    it('produces different hashes for the same password (random salt)', () => {
      const hash1 = hashPassword('same-password');
      const hash2 = hashPassword('same-password');
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes for different passwords', () => {
      const hash1 = hashPassword('password-one');
      const hash2 = hashPassword('password-two');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for the correct password', () => {
      const hash = hashPassword('correct-password');
      expect(verifyPassword('correct-password', hash)).toBe(true);
    });

    it('returns false for an incorrect password', () => {
      const hash = hashPassword('correct-password');
      expect(verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('returns false for a malformed hash (no colon)', () => {
      expect(verifyPassword('test', 'not-a-valid-hash')).toBe(false);
    });

    it('returns false for a malformed hash (empty salt)', () => {
      expect(verifyPassword('test', ':abc123')).toBe(false);
    });

    it('returns false for a malformed hash (empty key)', () => {
      expect(verifyPassword('test', 'abc123:')).toBe(false);
    });

    it('returns false for a malformed hash (too many colons)', () => {
      expect(verifyPassword('test', 'a:b:c')).toBe(false);
    });

    it('handles empty password', () => {
      const hash = hashPassword('');
      expect(verifyPassword('', hash)).toBe(true);
      expect(verifyPassword('notempty', hash)).toBe(false);
    });

    it('handles unicode passwords', () => {
      const hash = hashPassword('пароль🔐');
      expect(verifyPassword('пароль🔐', hash)).toBe(true);
      expect(verifyPassword('пароль', hash)).toBe(false);
    });
  });
});
