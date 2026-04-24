'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { StatusBar } from './status-bar';
import { getToken } from '@/lib/auth';
import { Toaster } from 'sonner';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PageLoader } from '@/components/ui/page-loader';
import { useTheme } from '@/hooks/use-theme';

// Lazy load heavy components that aren't needed for initial render
const LazyAiPanel = dynamic(
  () => import('./ai-panel').then(mod => ({ default: mod.AiPanel })),
  {
    ssr: false,
    loading: () => <div className="w-80 border-l border-white/5 bg-bg-secondary animate-pulse" />
  }
);

const LazyCommandPalette = dynamic(
  () => import('@/components/ui/command-palette').then(mod => ({ default: mod.CommandPalette })),
  {
    ssr: false,
    loading: () => null
  }
);

const LazyGlobalSearch = dynamic(
  () => import('@/components/search/global-search').then(mod => ({ default: mod.GlobalSearch })),
  {
    ssr: false,
    loading: () => null
  }
);

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!getToken()) {
      router.replace('/auth/login');
    } else {
      setReady(true);
    }
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setAiPanelOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleAssistant={() => setAiPanelOpen(!aiPanelOpen)} />
        <main id="main-content" className="flex-1 overflow-auto">
          <div className="flex h-full">
            <div className="flex-1 overflow-auto p-6">
              <Breadcrumbs />
              {children}
            </div>
            <Suspense fallback={<div className="w-80 border-l border-white/5 bg-bg-secondary animate-pulse" />}>
              <LazyAiPanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
            </Suspense>
          </div>
        </main>
        <StatusBar />
      </div>
      <LazyGlobalSearch />
      <LazyCommandPalette />
      <Toaster position="bottom-right" theme={resolvedTheme} />
    </div>
  );
}
