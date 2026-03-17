import { describe, it, expect } from 'vitest';
import { getDb, disconnectDb } from '../index.js';

describe('@airevstream/db', () => {
  it('exports getDb function', () => {
    expect(typeof getDb).toBe('function');
  });

  it('exports disconnectDb function', () => {
    expect(typeof disconnectDb).toBe('function');
  });

  it('getDb returns a PrismaClient instance', () => {
    const db = getDb();
    expect(db).toBeDefined();
    expect(typeof db.$connect).toBe('function');
    expect(typeof db.$disconnect).toBe('function');
  });

  it('getDb returns the same instance on multiple calls', () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});
