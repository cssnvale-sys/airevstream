'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, FileText, Users, Layers, Zap, Calendar, BarChart3, Settings, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContent, useChannels, useApi } from '@/hooks/use-api';
import { useSeries } from '@/hooks/use-series';

interface SearchResult {
  id: string;
  type: 'content' | 'channel' | 'series' | 'page';
  title: string;
  subtitle?: string;
  href: string;
  icon: React.ReactNode;
}

const STATIC_PAGES: SearchResult[] = [
  { id: 'dashboard', type: 'page', title: 'Dashboard', href: '/dashboard', icon: <Command size={16} /> },
  { id: 'create', type: 'page', title: 'Create Content', href: '/create', icon: <Zap size={16} /> },
  { id: 'content', type: 'page', title: 'Content Library', href: '/content', icon: <FileText size={16} /> },
  { id: 'channels', type: 'page', title: 'Channels', href: '/channels', icon: <Layers size={16} /> },
  { id: 'calendar', type: 'page', title: 'Content Calendar', href: '/calendar', icon: <Calendar size={16} /> },
  { id: 'analytics', type: 'page', title: 'Analytics', href: '/analytics', icon: <BarChart3 size={16} /> },
  { id: 'approvals', type: 'page', title: 'Approvals', href: '/approvals', icon: <Command size={16} /> },
  { id: 'accounts', type: 'page', title: 'Accounts', href: '/accounts', icon: <Users size={16} /> },
  { id: 'settings', type: 'page', title: 'Settings', href: '/settings', icon: <Settings size={16} /> },
];

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const { data: contentRes, error: contentError } = useContent<any[]>('limit=50');
  const { data: channelsRes, error: channelsError } = useChannels<any[]>('limit=50');
  const { data: seriesRes, error: seriesError } = useSeries<any[]>('limit=50');

  const contentItems: any[] = contentRes?.data ?? [];
  const channels: any[] = channelsRes?.data ?? [];
  const series: any[] = seriesRes?.data ?? [];

  // Build search results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return STATIC_PAGES;

    const filtered: SearchResult[] = [];

    // Filter static pages
    STATIC_PAGES.forEach(page => {
      if (page.title.toLowerCase().includes(q)) {
        filtered.push(page);
      }
    });

    // Filter content
    contentItems.forEach(item => {
      if (item.title?.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)) {
        filtered.push({
          id: `content-${item.id}`,
          type: 'content',
          title: item.title ?? 'Untitled',
          subtitle: item.channel?.name ?? 'No channel',
          href: `/content/${item.id}`,
          icon: <FileText size={16} className="text-accent-blue" />,
        });
      }
    });

    // Filter channels
    channels.forEach((channel: { id: string; name: string }) => {
      if (channel.name.toLowerCase().includes(q)) {
        filtered.push({
          id: `channel-${channel.id}`,
          type: 'channel',
          title: channel.name,
          href: `/channels/${channel.id}`,
          icon: <Layers size={16} className="text-accent-purple" />,
        });
      }
    });

    // Filter series
    series.forEach((s: { id: string; name: string; channel?: { name: string } }) => {
      if (s.name.toLowerCase().includes(q)) {
        filtered.push({
          id: `series-${s.id}`,
          type: 'series',
          title: s.name,
          subtitle: s.channel?.name,
          href: `/series/${s.id}`,
          icon: <Layers size={16} className="text-accent-green" />,
        });
      }
    });

    return filtered.slice(0, 20);
  }, [query, contentItems, channels, series]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback((result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
    setQuery('');
  }, [router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  }, [results, selectedIndex, handleSelect]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-bg-primary rounded-xl shadow-2xl border border-border overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={20} className="text-text-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search content, channels, series..."
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-secondary outline-none text-base"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs rounded bg-bg-tertiary text-text-secondary">
              ESC
            </kbd>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-secondary">
              <Search size={32} className="mx-auto mb-2 opacity-50" />
              <p>No results found for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="py-2">
              {/* Group by type */}
              {['page', 'content', 'channel', 'series'].map((type) => {
                const typeResults = results.filter(r => r.type === type);
                if (typeResults.length === 0) return null;
                
                const typeLabels: Record<string, string> = {
                  page: 'Pages',
                  content: 'Content',
                  channel: 'Channels',
                  series: 'Series',
                };
                
                return (
                  <div key={type}>
                    <div className="px-4 py-1 text-xs font-medium text-text-secondary uppercase tracking-wider">
                      {typeLabels[type]}
                    </div>
                    {typeResults.map((result, idx) => {
                      const globalIdx = results.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors',
                            globalIdx === selectedIndex ? 'bg-accent-blue/10' : 'hover:bg-bg-secondary'
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0">
                            {result.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-medium truncate',
                              globalIdx === selectedIndex ? 'text-accent-blue' : 'text-text-primary'
                            )}>
                              {result.title}
                            </p>
                            {result.subtitle && (
                              <p className="text-xs text-text-secondary truncate">{result.subtitle}</p>
                            )}
                          </div>
                          {globalIdx === selectedIndex && (
                            <kbd className="px-2 py-0.5 text-xs rounded bg-bg-tertiary text-text-secondary">
                              ↵
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-bg-secondary flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary">↵</kbd>
              Select
            </span>
          </div>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
