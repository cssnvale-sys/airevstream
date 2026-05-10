'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Breadcrumb } from './breadcrumb';

interface BreadcrumbItemDef {
  label: string;
  href: string;
  isActive?: boolean;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: BreadcrumbItemDef[];
  actions?: React.ReactNode;
  metadata?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = 'Back',
  breadcrumbs,
  actions,
  metadata,
  icon,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`mb-6 ${className}`}>
      {breadcrumbs && <Breadcrumb items={breadcrumbs} />}

      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-blue transition-colors mb-3"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </Link>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          </div>
          {description && (
            <p className="text-sm text-text-secondary mt-1">{description}</p>
          )}
          {metadata && <div className="mt-2">{metadata}</div>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function PageHeaderSkeleton() {
  return (
    <header className="mb-6 animate-pulse">
      <div className="h-3 w-32 bg-bg-tertiary rounded mb-3" />
      <div className="h-8 w-48 bg-bg-tertiary rounded mb-2" />
      <div className="h-4 w-64 bg-bg-tertiary rounded" />
    </header>
  );
}
