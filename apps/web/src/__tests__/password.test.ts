import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/password';

describe('password', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt formatted string', () => {
      const hash = hashPassword('test-password');
      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
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

    it('returns false for a malformed hash (not bcrypt)', () => {
      expect(verifyPassword('test', 'not-a-valid-hash')).toBe(false);
    });

    it('returns false for a legacy scrypt hash (salt:key format)', () => {
      expect(verifyPassword('test', 'abc123:')).toBe(false);
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
