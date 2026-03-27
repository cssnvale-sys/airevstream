'use client';

import { useState } from 'react';
import { apiPost } from '@/hooks/use-api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { CheckCircle, ExternalLink, AlertTriangle, Clock, User } from 'lucide-react';
import { toast } from '@/lib/toast';
import { LoadingButton } from '@/components/ui/loading-button';
import Link from 'next/link';

export interface HitlTask {
  id: string;
  jobType: string;
  status: string;
  priority: number;
  needsHuman: boolean;
  humanTaskDesc: string | null;
  humanLinks: unknown;
  createdAt: string;
  content?: { id: string; title: string; contentType: string } | null;
}

interface HitlTaskCardProps {
  task: HitlTask;
  onComplete: () => void;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Urgent', color: 'text-accent-red bg-accent-red/10' },
  2: { label: 'High', color: 'text-accent-amber bg-accent-amber/10' },
  3: { label: 'Normal', color: 'text-text-secondary bg-bg-tertiary' },
  4: { label: 'Low', color: 'text-text-secondary bg-bg-tertiary' },
};

export function HitlTaskCard({ task, onComplete }: HitlTaskCardProps) {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiPost(`/workflows/hitl/${task.id}/complete`);
      toast.success('Task marked complete');
      onComplete();
    } catch (err) {
      console.error('Failed to complete HITL task:', err);
      toast.error('Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  const priorityConfig = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS[3];
  const links = (task.humanLinks as Record<string, string>) ?? {};

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent-amber/10 shrink-0">
          <User size={18} className="text-accent-amber" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary text-sm">
              {task.humanTaskDesc ?? task.jobType.replace(/_/g, ' ')}
            </span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', priorityConfig.color)}>
              {priorityConfig.label}
            </span>
          </div>
          {task.content && (
            <Link
              href={`/content/${task.content.id}`}
              className="text-xs text-accent-blue hover:underline mt-0.5 inline-block"
            >
              {task.content.title} ({task.content.contentType})
            </Link>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
            <Clock size={10} />
            <span>{formatRelativeTime(task.createdAt)}</span>
          </div>
          {Object.keys(links).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(links).map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-accent-blue hover:underline"
                >
                  <ExternalLink size={10} />
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
        <LoadingButton
          onClick={handleComplete}
          loading={completing}
          className="btn-primary btn-sm flex items-center gap-1 shrink-0"
        >
          <CheckCircle size={14} />
          Complete
        </LoadingButton>
      </div>
    </div>
  );
}
