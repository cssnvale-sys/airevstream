'use client';

import { useState, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi, apiPost } from '@/hooks/use-api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Check, X, Loader2, FileText, Video, Image, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';

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

const CONTENT_TYPES = ['all', 'video_short', 'video_long', 'image', 'article', 'post'] as const;
const PAGE_SIZE = 20;

export default function ApprovalsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [bulkActing, setBulkActing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);

  const queryParams = useMemo(() => {
    const parts = [`page=${page}`, `limit=${PAGE_SIZE}`];
    if (typeFilter !== 'all') parts.push(`contentType=${typeFilter}`);
    return parts.join('&');
  }, [page, typeFilter]);

  const { data: approvalsRes, isLoading, mutate } = useApi<ApprovalItem[]>(`/approvals?${queryParams}`);
  const items = approvalsRes?.data ?? [];
  const meta = approvalsRes?.meta;
  const totalPages = meta?.pages ?? 1;

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      await apiPost(`/approvals/${id}/${action}`);
      mutate();
      toast.success(action === 'approve' ? 'Content approved' : 'Content rejected');
    } catch (err) {
      toast.error(`Failed to ${action} content`);
    } finally {
      setActing(null);
      setRejectTarget(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    setBulkRejectOpen(false);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        await apiPost(`/approvals/${id}/${action}`);
        successCount++;
      } catch (err) {
        console.error(`Bulk ${action} failed for item ${id}:`, err);
        failCount++;
      }
    }

    mutate();
    setSelectedIds(new Set());
    setBulkActing(false);

    if (failCount === 0) {
      toast.success(`${successCount} item${successCount > 1 ? 's' : ''} ${action === 'approve' ? 'approved' : 'rejected'}`);
    } else {
      toast.error(`${successCount} succeeded, ${failCount} failed`);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }, [items, selectedIds.size]);

  const updateTypeFilter = (t: string) => {
    setTypeFilter(t);
    setPage(1);
    setSelectedIds(new Set());
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Approval Queue</h1>
          <div className="flex items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => updateTypeFilter(e.target.value)}
              className="input text-caption"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All Types' : t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
            <span className="text-sm text-text-secondary">{meta?.total ?? items.length} pending</span>
          </div>
        </div>

        {/* Bulk actions toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
            <span className="text-sm font-medium text-text-primary">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => handleBulkAction('approve')}
              disabled={bulkActing}
              className="btn-primary btn-sm flex items-center gap-1"
            >
              {bulkActing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Approve All
            </button>
            <button
              onClick={() => setBulkRejectOpen(true)}
              disabled={bulkActing}
              className="btn-danger btn-sm flex items-center gap-1"
            >
              <X size={14} />
              Reject All
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="btn-secondary btn-sm ml-auto"
            >
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-text-secondary" size={32} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="All caught up!"
            description="No content pending approval. New content will appear here when it needs your review."
          />
        ) : (
          <>
            {/* Select all */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={selectedIds.size === items.length && items.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-border"
                aria-label="Select all"
              />
              <span className="text-xs text-text-secondary">Select all</span>
            </div>

            <div className="space-y-3">
              {items.map((item) => {
                const Icon = TYPE_ICONS[item.contentType] ?? FileText;
                return (
                  <div key={item.id} className="card flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-border shrink-0"
                      aria-label={`Select ${item.title ?? 'content'}`}
                    />
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-text-secondary">
                  Page {page} of {totalPages} ({meta?.total ?? 0} total)
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-icon"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn-icon"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
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

        <ConfirmDialog
          open={bulkRejectOpen}
          title="Reject Selected Content"
          message={`Are you sure you want to reject ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}? They will be moved back to draft.`}
          confirmLabel="Reject All"
          variant="danger"
          onConfirm={() => handleBulkAction('reject')}
          onCancel={() => setBulkRejectOpen(false)}
        />
      </div>
    </AppLayout>
  );
}
