'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Home',
  accounts: 'Accounts',
  channels: 'Channels',
  series: 'Series',
  assets: 'Assets',
  calendar: 'Calendar',
  create: 'Create',
  library: 'Library',
  content: 'Content',
  approvals: 'Approvals',
  analytics: 'Analytics',
  experiments: 'Experiments',
  system: 'System',
  affiliate: 'Affiliate',
  settings: 'Settings',
  workflows: 'Workflows',
  profile: 'Profile',
  seasoning: 'Seasoning',
  budgets: 'Budgets',
  studio: 'Studio',
};

function segmentLabel(segment: string): string {
  return LABEL_MAP[segment] ?? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on the dashboard home page
  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const label = isUUID(segment) ? 'Detail' : segmentLabel(segment);
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-text-secondary mb-4">
      <Link href="/dashboard" aria-label="Home" className="hover:text-text-primary transition-colors">
        <Home size={12} />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight size={10} className="opacity-50" />
          {crumb.isLast ? (
            <span className="text-text-primary font-medium" aria-current="page">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-text-primary transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
