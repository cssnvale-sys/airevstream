'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Sparkles,
  Library,
  BarChart3,
  Activity,
  BadgeDollarSign,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  ClipboardCheck,
} from 'lucide-react';
import { removeToken } from '@/lib/auth';
import { useState, useEffect, useCallback } from 'react';
import { KeyboardShortcutsModal } from '@/components/ui/keyboard-shortcuts';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Users },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/create', label: 'Create', icon: Sparkles },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/system', label: 'System', icon: Activity },
  { href: '/affiliate', label: 'Affiliate', icon: BadgeDollarSign },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === '1';
    }
    return false;
  });
  const [showShortcuts, setShowShortcuts] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  const handleLogout = () => {
    removeToken();
    window.location.href = '/auth/login';
  };

  // Global keyboard shortcuts
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;

    switch (e.key) {
      case '?':
        setShowShortcuts((v) => !v);
        break;
      case 'n':
      case 'N':
        if (!e.metaKey && !e.ctrlKey) router.push('/create');
        break;
      case 'l':
      case 'L':
        if (!e.metaKey && !e.ctrlKey) router.push('/library');
        break;
      case 'a':
      case 'A':
        if (!e.metaKey && !e.ctrlKey) router.push('/analytics');
        break;
    }
  }, [router]);

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  return (
    <aside
      className={cn(
        'bg-bg-secondary border-r border-border flex flex-col h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <div className={cn('p-4 flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="w-8 h-8 rounded-lg bg-accent-purple flex items-center justify-center text-white font-bold text-sm shrink-0">
          A
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-card-title text-text-primary font-semibold">AiRevStream</h1>
            <p className="text-caption text-text-secondary">MPCAS</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 mt-2 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-body transition-colors',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border space-y-0.5">
        <button
          onClick={() => setShowShortcuts(true)}
          aria-label="Show keyboard shortcuts"
          title={collapsed ? 'Keyboard Shortcuts (?)' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-body text-text-secondary hover:bg-bg-tertiary hover:text-text-primary w-full transition-colors',
            collapsed && 'justify-center px-2',
          )}
        >
          <HelpCircle size={18} className="shrink-0" />
          {!collapsed && 'Shortcuts'}
        </button>
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-body text-text-secondary hover:bg-bg-tertiary hover:text-text-primary w-full transition-colors',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && 'Collapse'}
        </button>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-body text-text-secondary hover:bg-bg-tertiary hover:text-text-primary w-full transition-colors',
            collapsed && 'justify-center px-2',
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>

      <KeyboardShortcutsModal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </aside>
  );
}
