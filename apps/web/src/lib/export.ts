/**
 * Client-side CSV export utility.
 * Handles escaping, nested field access, and triggers browser download.
 */

interface CsvColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | null | undefined);
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Prevent CSV injection: prefix formula-triggering characters with a single quote
  const needsFormulaGuard = str.length > 0 && ['=', '+', '-', '@'].includes(str[0]);
  if (needsFormulaGuard || str.includes(',') || str.includes('"') || str.includes('\n')) {
    const escaped = str.replace(/"/g, '""');
    return `"${needsFormulaGuard ? `'${escaped}` : escaped}"`;
  }
  return str;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToCSV<T = any>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  const headerRow = columns.map((col) => escapeCell(col.header)).join(',');

  const dataRows = data.map((row) =>
    columns
      .map((col) => {
        const value =
          typeof col.accessor === 'function'
            ? col.accessor(row)
            : (row as Record<string, unknown>)[col.accessor as string];
        return escapeCell(value);
      })
      .join(','),
  );

  const csv = [headerRow, ...dataRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
