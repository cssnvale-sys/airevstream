import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv (16 bytes) + authTag (16 bytes) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

/**
 * Decrypt a hex-encoded ciphertext string encrypted with AES-256-GCM.
 */
export function decrypt(ciphertextHex: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }

  const data = Buffer.from(ciphertextHex, 'hex');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Generate a random 256-bit encryption key as a hex string.
 */
export function generateKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a value using SHA-256.
 */
export function sha256(input: string): string {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}
