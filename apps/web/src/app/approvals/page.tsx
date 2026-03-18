'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi, apiPost } from '@/hooks/use-api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Check, X, Loader2, FileText, Video, Image } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface ApprovalItem {
  id: string;
  title: string | null;
  contentType: string;
  status: string;
  qualityScore: number | null;
  createdAt: string;
  channel?: { id: string; name: string };
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  video_short: Video,
  video_long: Video,
  image: Image,
};

export default function ApprovalsPage() {
  const { data: approvalsRes, isLoading, mutate } = useApi('/approvals?limit=50');
  const items = (approvalsRes?.data as unknown as ApprovalItem[]) ?? [];
  const [acting, setActing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      await apiPost(`/approvals/${id}/${action}`);
      mutate();
      toast.success(action === 'approve' ? 'Content approved' : 'Content rejected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} content`);
    } finally {
      setActing(null);
      setRejectTarget(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Approval Queue</h1>
          <span className="text-sm text-text-secondary">{items.length} pending</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-text-secondary" size={32} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-text-secondary">
            No content pending approval.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.contentType] ?? FileText;
              return (
                <div key={item.id} className="card flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-accent-amber/10">
                    <Icon size={18} className="text-accent-amber" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-primary truncate">
                      {item.title ?? 'Untitled content'}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {item.channel?.name ?? 'No channel'} | {item.contentType} | {formatRelativeTime(item.createdAt)}
                      {item.qualityScore != null && ` | Quality: ${Number(item.qualityScore)}/10`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(item.id, 'approve')}
                      disabled={acting === item.id}
                      className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                    >
                      {acting === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectTarget(item.id)}
                      disabled={acting === item.id}
                      className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5 text-accent-red"
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ConfirmDialog
          open={!!rejectTarget}
          title="Reject Content"
          message="This content will be rejected and moved back to draft. The creator will need to revise it."
          confirmLabel="Reject"
          variant="warning"
          onConfirm={() => rejectTarget && handleAction(rejectTarget, 'reject')}
          onCancel={() => setRejectTarget(null)}
          loading={acting === rejectTarget}
        />
      </div>
    </AppLayout>
  );
}
