import { describe, it, expect } from 'vitest';
import { getQueue, getConnectionOptions, resetConnection, closeAllQueues } from '../index.js';

describe('@airevstream/queue', () => {
  it('exports getQueue function', () => {
    expect(typeof getQueue).toBe('function');
  });

  it('exports getConnectionOptions function', () => {
    expect(typeof getConnectionOptions).toBe('function');
  });

  it('exports resetConnection function', () => {
    expect(typeof resetConnection).toBe('function');
  });

  it('exports closeAllQueues function', () => {
    expect(typeof closeAllQueues).toBe('function');
  });

  it('parses redis URL into connection options', () => {
    resetConnection();
    const opts = getConnectionOptions('redis://localhost:6379');
    expect(opts).toMatchObject({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    });
    resetConnection();
  });
});
