import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateKey, sha256 } from '../index.js';

describe('@airevstream/crypto', () => {
  const testKey = generateKey();

  describe('encrypt/decrypt', () => {
    it('encrypts and decrypts a string', () => {
      const plaintext = 'my-secret-api-token';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext each time (random IV)', () => {
      const plaintext = 'same-input';
      const a = encrypt(plaintext, testKey);
      const b = encrypt(plaintext, testKey);
      expect(a).not.toBe(b);
    });

    it('handles empty strings', () => {
      const encrypted = encrypt('', testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe('');
    });

    it('handles unicode', () => {
      const plaintext = 'Hello 🌍 Wörld! 日本語';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(plaintext);
    });

    it('fails with wrong key', () => {
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext, testKey);
      const wrongKey = generateKey();
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('fails with tampered ciphertext', () => {
      const encrypted = encrypt('secret', testKey);
      const tampered = encrypted.slice(0, -2) + 'ff';
      expect(() => decrypt(tampered, testKey)).toThrow();
    });

    it('rejects invalid key length', () => {
      expect(() => encrypt('test', 'short')).toThrow('Encryption key must be 32 bytes');
    });
  });

  describe('generateKey', () => {
    it('generates a 64-character hex string', () => {
      const key = generateKey();
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates unique keys', () => {
      const keys = new Set(Array.from({ length: 10 }, () => generateKey()));
      expect(keys.size).toBe(10);
    });
  });

  describe('sha256', () => {
    it('hashes a string', () => {
      const hash = sha256('hello');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });
  });
});
