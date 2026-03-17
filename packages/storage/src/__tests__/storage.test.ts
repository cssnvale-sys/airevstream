import { describe, it, expect } from 'vitest';
import { getStorageClient, resetStorageClient } from '../index.js';

describe('@airevstream/storage', () => {
  it('exports getStorageClient function', () => {
    expect(typeof getStorageClient).toBe('function');
  });

  it('creates a MinIO client with custom config', () => {
    resetStorageClient();
    const client = getStorageClient({
      endPoint: 'localhost',
      port: 9000,
      accessKey: 'test',
      secretKey: 'test-secret',
      useSSL: false,
    });
    expect(client).toBeDefined();
    expect(typeof client.putObject).toBe('function');
    expect(typeof client.getObject).toBe('function');
    resetStorageClient();
  });

  it('returns the same client on multiple calls', () => {
    resetStorageClient();
    const c1 = getStorageClient({
      endPoint: 'localhost',
      port: 9000,
      accessKey: 'test',
      secretKey: 'test-secret',
    });
    const c2 = getStorageClient();
    expect(c1).toBe(c2);
    resetStorageClient();
  });
});
