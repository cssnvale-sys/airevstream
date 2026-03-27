'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import {
  Search, FileText, Film, Image, Video, Mic, ImageIcon, Radio, Users, X,
  LayoutDashboard, CalendarDays, Sparkles, Library, BarChart3, Activity,
  BadgeDollarSign, Wallet, Settings, ClipboardCheck, Sprout, GitBranch,
  Layers, Palette, FlaskConical,
} from 'lucide-react';

interface SearchResults {
  content: Array<{ id: string; title: string | null; contentType: string; status: string }>;
  channels: Array<{ id: string; name: string; platform: string }>;
  accounts: Array<{ id: string; username: string | null; platform: string }>;
}

function contentTypeIcon(type: string) {
  switch (type) {
    case 'text': return FileText;
    case 'image': return Image;
    case 'video_short': return Film;
    case 'video_long': return Video;
    case 'voice': return Mic;
    case 'thumbnail': return ImageIcon;
    default: return FileText;
  }
}

const PAGE_LINKS = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Accounts', href: '/accounts', icon: Users },
  { label: 'Channels', href: '/channels', icon: Radio },
  { label: 'Series', href: '/series', icon: Layers },
  { label: 'Assets', href: '/assets', icon: Palette },
  { label: 'Seasoning', href: '/seasoning', icon: Sprout },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays },
  { label: 'Create', href: '/create', icon: Sparkles },
  { label: 'Studio', href: '/studio', icon: Film },
  { label: 'Library', href: '/library', icon: Library },
  { label: 'Approvals', href: '/approvals', icon: ClipboardCheck },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Experiments', href: '/experiments', icon: FlaskConical },
  { label: 'System', href: '/system', icon: Activity },
  { label: 'Workflows', href: '/workflows', icon: GitBranch },
  { label: 'Affiliate', href: '/affiliate', icon: BadgeDollarSign },
  { label: 'Budgets', href: '/budgets', icon: Wallet },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const debouncedQuery = useDebounce(query, 200);
  const { data } = useApi<SearchResults>(
    debouncedQuery.length >= 2 ? `/search?q=${encodeURIComponent(debouncedQuery)}` : null,
  );
  const results = data?.data;

  // Build flat list of results for keyboard navigation
  const flatResults: Array<{ type: string; id: string; label: string; href: string; icon: typeof FileText }> = [];

  // Add matching page links
  const lowerQuery = query.toLowerCase();
  const matchingPages = query.length === 0
    ? PAGE_LINKS
    : PAGE_LINKS.filter((p) => p.label.toLowerCase().includes(lowerQuery));
  for (const page of matchingPages) {
    flatResults.push({ type: 'page', id: page.href, label: page.label, href: page.href, icon: page.icon });
  }

  // Add API search results when query >= 2 chars
  if (results) {
    for (const item of results.content) {
      const Icon = contentTypeIcon(item.contentType);
      flatResults.push({ type: 'content', id: item.id, label: item.title ?? 'Untitled', href: `/content/${item.id}`, icon: Icon });
    }
    for (const ch of results.channels) {
      flatResults.push({ type: 'channel', id: ch.id, label: ch.name, href: `/accounts`, icon: Radio });
    }
    for (const acc of results.accounts) {
      flatResults.push({ type: 'account', id: acc.id, label: acc.username ?? acc.platform, href: `/accounts`, icon: Users });
    }
  }

  // Cmd+K toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation inside palette
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      setOpen(false);
      router.push(flatResults[selectedIndex].href);
    }
  }, [flatResults, selectedIndex, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60"
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg mx-4 bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-text-secondary shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search content, channels, accounts..."
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-secondary outline-none text-sm"
          />
          <button onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {flatResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-secondary">
              No results found
            </div>
          ) : (
            <div className="py-1">
              {flatResults.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => { setOpen(false); router.push(item.href); }}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors',
                      i === selectedIndex
                        ? 'bg-accent-blue/10 text-text-primary'
                        : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                    )}
                  >
                    <Icon size={16} className="shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-xs opacity-50 capitalize">{item.type}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-text-secondary">
          <span><kbd className="px-1 py-0.5 rounded bg-bg-tertiary text-text-primary">&#8593;&#8595;</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-bg-tertiary text-text-primary">&#8629;</kbd> Open</span>
          <span><kbd className="px-1 py-0.5 rounded bg-bg-tertiary text-text-primary">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
