'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { StatusBar } from './status-bar';
import { AiPanel } from './ai-panel';
import { getToken } from '@/lib/auth';
import { Toaster } from 'sonner';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

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
        <main className="flex-1 overflow-auto">
          <div className="flex h-full">
            <div className="flex-1 overflow-auto p-6">{children}</div>
            <AiPanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
          </div>
        </main>
        <StatusBar />
      </div>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}
