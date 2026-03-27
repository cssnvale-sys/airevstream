'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Sparkles,
  Film,
  Library,
  BarChart3,
  Activity,
  BadgeDollarSign,
  Wallet,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  ClipboardCheck,
  Sprout,
  GitBranch,
  FlaskConical,
  Radio,
  Layers,
  Palette,
  Menu,
  X,
} from 'lucide-react';
import { removeToken, getToken } from '@/lib/auth';
import { useState, useEffect, useCallback } from 'react';
import { KeyboardShortcutsModal } from '@/components/ui/keyboard-shortcuts';
import useSWR from 'swr';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Users },
  { href: '/channels', label: 'Channels', icon: Radio },
  { href: '/series', label: 'Series', icon: Layers },
  { href: '/assets', label: 'Assets', icon: Palette },
  { href: '/seasoning', label: 'Seasoning', icon: Sprout },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/create', label: 'Create', icon: Sparkles },
  { href: '/studio', label: 'Studio', icon: Film },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/experiments', label: 'Experiments', icon: FlaskConical },
  { href: '/system', label: 'System', icon: Activity },
  { href: '/workflows', label: 'Workflows', icon: GitBranch },
  { href: '/affiliate', label: 'Affiliate', icon: BadgeDollarSign },
  { href: '/budgets', label: 'Budgets', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const hitlFetcher = async (url: string) => {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json();
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: hitlData } = useSWR('/api/v1/workflows/hitl?limit=1', hitlFetcher, { refreshInterval: 30000 });
  const hitlCount = hitlData?.meta?.total ?? hitlData?.total ?? 0;
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === '1';
    }
    return false;
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mobileOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

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
      case 'w':
      case 'W':
        if (!e.metaKey && !e.ctrlKey) router.push('/workflows');
        break;
      case 'e':
      case 'E':
        if (!e.metaKey && !e.ctrlKey) router.push('/experiments');
        break;
      case 'c':
      case 'C':
        if (!e.metaKey && !e.ctrlKey) router.push('/channels');
        break;
      case 'r':
      case 'R':
        if (!e.metaKey && !e.ctrlKey) router.push('/series');
        break;
      case 't':
      case 'T':
        if (!e.metaKey && !e.ctrlKey) router.push('/assets');
        break;
      case 'd':
      case 'D':
        if (!e.metaKey && !e.ctrlKey) router.push('/dashboard');
        break;
      case 's':
      case 'S':
        if (!e.metaKey && !e.ctrlKey) router.push('/settings');
        break;
      case 'p':
      case 'P':
        if (!e.metaKey && !e.ctrlKey) router.push('/approvals');
        break;
      case 'y':
      case 'Y':
        if (!e.metaKey && !e.ctrlKey) router.push('/system');
        break;
    }
  }, [router]);

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  // Shared sidebar content (used for both desktop and mobile)
  const sidebarContent = (isMobile: boolean) => (
    <>
      <div className={cn('p-4 flex items-center', !isMobile && collapsed ? 'justify-center' : 'gap-3')}>
        <div className="w-8 h-8 rounded-lg bg-accent-purple flex items-center justify-center text-white font-bold text-sm shrink-0">
          A
        </div>
        {(isMobile || !collapsed) && (
          <div className="flex-1 min-w-0">
            <h1 className="text-card-title text-text-primary font-semibold">AiRevStream</h1>
            <p className="text-caption text-text-secondary">MPCAS</p>
          </div>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="p-2.5 rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
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
              title={!isMobile && collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-body transition-colors',
                !isMobile && collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
              )}
            >
              <Icon size={18} className="shrink-0" />
              {(isMobile || !collapsed) && item.label}
              {item.href === '/workflows' && hitlCount > 0 && (isMobile || !collapsed) && (
                <span className="ml-auto min-w-[18px] h-[18px] bg-accent-red text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {hitlCount > 99 ? '99+' : hitlCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border space-y-0.5 safe-bottom">
        <button
          onClick={() => setShowShortcuts(true)}
          aria-label="Show keyboard shortcuts"
          title={!isMobile && collapsed ? 'Keyboard Shortcuts (?)' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-body text-text-secondary hover:bg-bg-tertiary hover:text-text-primary w-full transition-colors',
            !isMobile && collapsed && 'justify-center px-2',
          )}
        >
          <HelpCircle size={18} className="shrink-0" />
          {(isMobile || !collapsed) && 'Shortcuts'}
        </button>
        {!isMobile && (
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
        )}
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-body text-text-secondary hover:bg-bg-tertiary hover:text-text-primary w-full transition-colors',
            !isMobile && collapsed && 'justify-center px-2',
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {(isMobile || !collapsed) && 'Sign Out'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button — fixed top-left, visible only below md */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-md bg-bg-secondary border border-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay drawer — visible only below md when open */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside
            className="absolute inset-y-0 left-0 w-72 bg-bg-secondary border-r border-border flex flex-col transform transition-transform duration-200 ease-out"
          >
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — hidden below md, normal flex item at md+ */}
      <aside
        className={cn(
          'hidden md:flex bg-bg-secondary border-r border-border flex-col h-screen sticky top-0 transition-all duration-200',
          collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
        )}
      >
        {sidebarContent(false)}
      </aside>

      <KeyboardShortcutsModal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  );
}
