'use client';

import { cn } from '@/lib/utils';
import { useSystemMetrics } from '@/hooks/use-api';

export function StatusBar() {
  const { data } = useSystemMetrics();
  const metrics = data?.data as Record<string, unknown> | undefined;

  // Flat metrics come back as { cpu: N, ram: N, queueDepth: N, metrics: {...} }
  const cpu = typeof metrics?.cpu === 'number' ? metrics.cpu : undefined;
  const ram = typeof metrics?.ram === 'number' ? metrics.ram : undefined;
  const queueDepth = typeof metrics?.queueDepth === 'number' ? metrics.queueDepth : undefined;
  const online = metrics != null;

  return (
    <footer className="h-statusbar bg-bg-secondary border-t border-border flex items-center px-6 text-caption text-text-secondary gap-6 z-30">
      <div className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full', online ? 'bg-accent-green' : 'bg-gray-500')} />
        <span>{online ? 'Online' : 'Connecting...'}</span>
      </div>
      <div>CPU: {cpu ?? '—'}%</div>
      <div>RAM: {ram ?? '—'}%</div>
      <div>Queue: {queueDepth ?? '—'}</div>
      <div className="flex-1" />
      <div>AiRevStream MPCAS v0.1</div>
    </footer>
  );
}
