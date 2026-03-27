'use client';

import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [20, 40, 60],
  className,
}: PaginationProps) {
  if (totalPages <= 1 && !onLimitChange) return null;

  const startItem = total === 0 ? 0 : Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  // Generate visible page numbers (max 5)
  const pageNumbers: number[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else if (page <= 3) {
    for (let i = 1; i <= 5; i++) pageNumbers.push(i);
  } else if (page >= totalPages - 2) {
    for (let i = totalPages - 4; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    for (let i = page - 2; i <= page + 2; i++) pageNumbers.push(i);
  }

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between text-sm text-text-secondary', className)}>
      <span>
        Showing {startItem}-{endItem} of {total}
      </span>
      <div className="flex items-center gap-3">
        {onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Items per page"
            className="input text-xs py-1 px-2"
          >
            {limitOptions.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="btn-secondary btn-sm p-2 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          {pageNumbers.map((num) => (
            <button
              key={num}
              onClick={() => onPageChange(num)}
              aria-current={page === num ? 'page' : undefined}
              className={cn(
                'btn-sm min-w-[36px] h-9 flex items-center justify-center rounded text-xs',
                page === num ? 'btn-primary' : 'btn-secondary',
              )}
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="btn-secondary btn-sm p-2 disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
