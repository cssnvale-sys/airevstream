import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DOM APIs needed by exportToCSV
let lastCreatedBlob: Blob | null = null;
let lastDownloadFilename = '';
const mockUrl = 'blob:test-url';

beforeEach(() => {
  lastCreatedBlob = null;
  lastDownloadFilename = '';

  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => { lastCreatedBlob = blob; return mockUrl; }),
    revokeObjectURL: vi.fn(),
  });

  const mockLink = {
    href: '',
    download: '',
    style: { display: '' },
    click: vi.fn(),
  };

  vi.stubGlobal('document', {
    createElement: vi.fn(() => mockLink),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  });

  // Capture filename
  Object.defineProperty(mockLink, 'download', {
    get: () => lastDownloadFilename,
    set: (val: string) => { lastDownloadFilename = val; },
  });
});

describe('exportToCSV', () => {
  it('generates CSV with headers and data rows', async () => {
    const { exportToCSV } = await import('../lib/export');

    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    exportToCSV(data, [
      { header: 'Name', accessor: 'name' },
      { header: 'Age', accessor: 'age' },
    ], 'test');

    expect(lastCreatedBlob).not.toBeNull();
    const text = await lastCreatedBlob!.text();
    expect(text).toBe('Name,Age\nAlice,30\nBob,25');
  });

  it('escapes commas in values', async () => {
    const { exportToCSV } = await import('../lib/export');

    exportToCSV(
      [{ name: 'Smith, John' }],
      [{ header: 'Name', accessor: 'name' }],
      'test',
    );

    const text = await lastCreatedBlob!.text();
    expect(text).toBe('Name\n"Smith, John"');
  });

  it('escapes double quotes in values', async () => {
    const { exportToCSV } = await import('../lib/export');

    exportToCSV(
      [{ note: 'He said "hello"' }],
      [{ header: 'Note', accessor: 'note' }],
      'test',
    );

    const text = await lastCreatedBlob!.text();
    expect(text).toBe('Note\n"He said ""hello"""');
  });

  it('escapes newlines in values', async () => {
    const { exportToCSV } = await import('../lib/export');

    exportToCSV(
      [{ text: 'line1\nline2' }],
      [{ header: 'Text', accessor: 'text' }],
      'test',
    );

    const text = await lastCreatedBlob!.text();
    expect(text).toContain('"line1\nline2"');
  });

  it('handles null and undefined values', async () => {
    const { exportToCSV } = await import('../lib/export');

    exportToCSV(
      [{ a: null, b: undefined }],
      [
        { header: 'A', accessor: 'a' as never },
        { header: 'B', accessor: 'b' as never },
      ],
      'test',
    );

    const text = await lastCreatedBlob!.text();
    expect(text).toBe('A,B\n,');
  });

  it('supports function accessors', async () => {
    const { exportToCSV } = await import('../lib/export');

    exportToCSV(
      [{ first: 'John', last: 'Doe' }],
      [{ header: 'Full Name', accessor: (row) => `${row.first} ${row.last}` }],
      'test',
    );

    const text = await lastCreatedBlob!.text();
    expect(text).toBe('Full Name\nJohn Doe');
  });

  it('appends .csv extension if missing', async () => {
    const { exportToCSV } = await import('../lib/export');
    exportToCSV([], [{ header: 'X', accessor: 'x' as never }], 'report');
    expect(lastDownloadFilename).toBe('report.csv');
  });

  it('does not double .csv extension', async () => {
    const { exportToCSV } = await import('../lib/export');
    exportToCSV([], [{ header: 'X', accessor: 'x' as never }], 'report.csv');
    expect(lastDownloadFilename).toBe('report.csv');
  });
});
