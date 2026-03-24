'use client';

import { Search, User, MessageSquare } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { NotificationCenter } from '@/components/notifications/notification-center';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Home',
  '/accounts': 'Accounts',
  '/seasoning': 'Seasoning',
  '/calendar': 'Content Calendar',
  '/create': 'Create Content',
  '/studio': 'Studio',
  '/library': 'Content Library',
  '/approvals': 'Approvals',
  '/analytics': 'Analytics',
  '/system': 'System Health',
  '/workflows': 'Workflows',
  '/affiliate': 'Affiliate Manager',
  '/budgets': 'Budgets',
  '/settings': 'Settings',
};

export function Header({ onToggleAssistant }: { onToggleAssistant: () => void }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? pathname.split('/').pop() ?? 'Dashboard';

  return (
    <header className="h-header bg-bg-secondary border-b border-border flex items-center px-6 pl-14 md:pl-6 gap-4 sticky top-0 z-30">
      <h2 className="text-section-heading text-text-primary">{title}</h2>

      <div className="flex-1 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
          }}
          aria-label="Search"
          className="input w-full pl-9 py-1.5 text-body text-left text-text-secondary relative cursor-pointer"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          Search... (Cmd+K)
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAssistant}
          className="btn-icon relative"
          title="AI Assistant (Cmd+/)"
          aria-label="AI Assistant"
        >
          <MessageSquare size={18} />
        </button>
        <NotificationCenter />
        <button className="btn-icon" aria-label="User profile">
          <User size={18} />
        </button>
      </div>
    </header>
  );
}
