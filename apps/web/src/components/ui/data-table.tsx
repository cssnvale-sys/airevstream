/**
 * Reusable data table component with sorting and filtering
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { PageLoader } from './page-loader';

type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  emptyState?: {
    title: string;
    description?: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  className?: string;
  rowClassName?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading,
  error,
  onRetry,
  searchable = false,
  searchKeys,
  emptyState,
  className,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle sorting
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => 
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Search filter
    if (searchable && searchQuery && searchKeys) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        searchKeys.some(key => {
          const value = item[key];
          return String(value).toLowerCase().includes(query);
        })
      );
    }

    // Sort
    if (sortKey && sortDirection) {
      result.sort((a, b) => {
        const aValue = getValue(a, sortKey) as string | number;
        const bValue = getValue(b, sortKey) as string | number;
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, searchKeys, sortKey, sortDirection, searchable]);

  // Get value from object by key (supports nested keys)
  function getValue(obj: T, key: string): unknown {
    return key.split('.').reduce((acc, part) => {
      return acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined;
    }, obj as unknown);
  }

  if (isLoading) {
    return <PageLoader type="list" />;
  }

  if (error) {
    return (
      <EmptyState
        icon={Filter}
        title="Failed to load data"
        description={error.message}
        action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
      />
    );
  }

  if (data.length === 0 && emptyState) {
    return (
      <EmptyState
        title={emptyState.title}
        description={emptyState.description}
        action={emptyState.action}
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search bar */}
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    "text-left py-3 px-4 text-sm font-medium text-text-secondary",
                    column.sortable && "cursor-pointer hover:text-text-primary select-none",
                    column.width
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && sortKey === column.key && (
                      sortDirection === 'asc' ? 
                        <ChevronUp size={14} /> : 
                        <ChevronDown size={14} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  "border-b border-border-secondary last:border-0",
                  onRowClick && "cursor-pointer hover:bg-bg-tertiary/50",
                  rowClassName
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td key={String(column.key)} className="py-3 px-4">
                    {column.render ? (
                      column.render(item)
                    ) : (
                      <span className="text-text-primary">
                        {String(getValue(item, String(column.key)) ?? '-')}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty search results */}
        {searchable && searchQuery && processedData.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-text-secondary text-sm">
              No results found for &quot;{searchQuery}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Results count */}
      {searchable && searchQuery && (
        <p className="text-text-secondary text-sm">
          Showing {processedData.length} of {data.length} results
        </p>
      )}
    </div>
  );
}

/**
 * Compact table for inline usage
 */
export function CompactTable<T>({
  data,
  columns,
  keyExtractor,
  className,
}: Omit<DataTableProps<T>, 'searchable' | 'error' | 'onRetry' | 'emptyState'>) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <tbody>
          {data.map((item) => (
            <tr 
              key={keyExtractor(item)}
              className="border-b border-border-secondary last:border-0"
            >
              {columns.map((column) => (
                <td key={String(column.key)} className="py-2 px-3">
                  {column.render ? (
                    column.render(item)
                  ) : (
                    <span className="text-text-primary">
                      {String((item as Record<string, unknown>)[String(column.key)] ?? '-')}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
