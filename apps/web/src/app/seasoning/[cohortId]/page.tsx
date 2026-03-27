'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { useCohort, useEnrollments } from '@/hooks/use-seasoning';
import { apiPost, apiPut } from '@/hooks/use-api';
import { PhasePipeline } from '@/components/seasoning/phase-pipeline';
import { EnrollmentTable } from '@/components/seasoning/enrollment-table';
import { ArrowLeft, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/lib/toast';

interface CohortDetail {
  id: string;
  name: string;
  status: string;
  platforms: string[];
  totalAccounts: number;
  completedAccounts: number;
  failedAccounts: number;
  phaseCounts: Record<string, number>;
  _count: { enrollments: number };
  createdAt: string;
  startedAt: string | null;
}

interface EnrollmentRow {
  id: string;
  platform: string;
  status: string;
  currentPhase: string | null;
  activitiesCompleted: number;
  lastActivityAt: string | null;
  nextScheduledAt: string | null;
  failureCount: number;
  failureReason: string | null;
  emailAccount: { id: string; email: string };
  socialAccount: { id: string; username: string | null; healthScore: number; status: string } | null;
}

export default function CohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [enrollIds, setEnrollIds] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);

  const filterParams = [
    statusFilter && `status=${statusFilter}`,
    platformFilter && `platform=${platformFilter}`,
  ].filter(Boolean).join('&');

  const { data: cohortRes, mutate: mutateCohort } = useCohort<CohortDetail>(cohortId);
  const { data: enrollmentsRes, mutate: mutateEnrollments } = useEnrollments<EnrollmentRow[]>(
    cohortId,
    filterParams || undefined,
    { refreshInterval: 15000 },
  );

  const cohort = cohortRes?.data;
  const enrollments = enrollmentsRes?.data ?? [];
  // Prefer live _count.enrollments over denormalized totalAccounts
  const enrollmentCount = cohort?._count?.enrollments ?? cohort?.totalAccounts ?? 0;

  const handleEnrollmentAction = async (enrollmentId: string, action: 'pause' | 'resume' | 'retry') => {
    try {
      const statusMap = { pause: 'paused', resume: 'phase_1', retry: 'phase_1' };
      await apiPut(`/seasoning/enrollments/${enrollmentId}`, { status: statusMap[action] });
      toast.success(`Enrollment ${action}d`);
      mutateEnrollments();
      mutateCohort();
    } catch (err) {
      console.error(`Failed to ${action} enrollment:`, err);
      toast.error(`Failed to ${action} enrollment`);
    }
  };

  const handleEnroll = async () => {
    if (!enrollIds.trim()) return;
    setEnrolling(true);
    try {
      const ids = enrollIds.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      await apiPost(`/seasoning/cohorts/${cohortId}/enroll`, {
        emailAccountIds: ids,
      });
      toast.success(`${ids.length} accounts enrolled`);
      setEnrollIds('');
      setShowEnroll(false);
      mutateCohort();
      mutateEnrollments();
    } catch (err) {
      console.error('Failed to enroll accounts:', err);
      toast.error('Failed to enroll accounts');
    } finally {
      setEnrolling(false);
    }
  };

  if (!cohort) {
    return <AppLayout><div className="animate-pulse h-64 bg-bg-tertiary rounded-lg" /></AppLayout>;
  }

  return (
    <AppLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/seasoning" className="text-text-secondary hover:text-text-primary">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-h2 text-text-primary">{cohort.name}</h1>
            <p className="text-caption text-text-secondary">
              {cohort.platforms.join(', ')} — {enrollmentCount} accounts
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEnroll(!showEnroll)}
            className="btn-primary btn-sm flex items-center gap-2"
          >
            <UserPlus size={14} />
            Enroll Accounts
          </button>
        </div>
      </div>

      {/* Enroll panel */}
      {showEnroll && (
        <div className="bg-bg-secondary border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-body text-text-primary">Enroll Email Account IDs</h3>
          <textarea
            value={enrollIds}
            onChange={(e) => setEnrollIds(e.target.value)}
            placeholder="Paste email account UUIDs (one per line or comma-separated)"
            className="w-full h-24 px-3 py-2 rounded-md bg-bg-primary border border-border text-text-primary text-caption font-mono focus:outline-none focus:ring-1 focus:ring-accent-blue"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowEnroll(false)} className="btn-ghost btn-sm">
              Cancel
            </button>
            <button
              onClick={handleEnroll}
              disabled={enrolling || !enrollIds.trim()}
              className="btn-primary btn-sm"
            >
              {enrolling ? 'Enrolling...' : 'Enroll'}
            </button>
          </div>
        </div>
      )}

      {/* Phase Pipeline */}
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <h3 className="text-body text-text-secondary mb-3">Pipeline Progress</h3>
        <PhasePipeline phaseCounts={cohort.phaseCounts} total={enrollmentCount} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="px-3 py-1.5 rounded-md bg-bg-secondary border border-border text-text-primary text-caption"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="signing_up">Signing Up</option>
          <option value="needs_human">Needs Human</option>
          <option value="phase_1">Phase 1</option>
          <option value="phase_2">Phase 2</option>
          <option value="phase_3">Phase 3</option>
          <option value="phase_4">Phase 4</option>
          <option value="seasoned">Seasoned</option>
          <option value="graduated">Graduated</option>
          <option value="failed">Failed</option>
          <option value="paused">Paused</option>
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          aria-label="Filter by platform"
          className="px-3 py-1.5 rounded-md bg-bg-secondary border border-border text-text-primary text-caption"
        >
          <option value="">All Platforms</option>
          {cohort.platforms.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="text-caption text-text-secondary ml-auto">
          {enrollments.length} enrollments
        </span>
      </div>

      {/* Enrollment Table */}
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <EnrollmentTable enrollments={enrollments} onAction={handleEnrollmentAction} />
      </div>
    </div>
    </AppLayout>
  );
}
