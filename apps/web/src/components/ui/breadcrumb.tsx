'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href: string;
  isActive?: boolean;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight size={14} className="text-text-tertiary" aria-hidden="true" />
            )}
            {item.isActive ? (
              <span className="text-text-secondary font-medium" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-text-secondary hover:text-accent-blue transition-colors"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function BreadcrumbSkeleton() {
  return (
    <div className="mb-4 flex items-center gap-2 animate-pulse">
      <div className="h-3 w-12 bg-bg-tertiary rounded" />
      <div className="h-3 w-3 bg-bg-tertiary rounded-full" />
      <div className="h-3 w-16 bg-bg-tertiary rounded" />
    </div>
  );
}
