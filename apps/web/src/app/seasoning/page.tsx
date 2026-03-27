'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { useCohorts, useSeasoningStats } from '@/hooks/use-seasoning';
import { apiPost } from '@/hooks/use-api';
import { CreateCohortModal } from '@/components/seasoning/create-cohort-modal';
import { PhasePipeline } from '@/components/seasoning/phase-pipeline';
import Link from 'next/link';
import { Sprout, Plus, Users, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';

interface CohortRow {
  id: string;
  name: string;
  status: string;
  platforms: string[];
  totalAccounts: number;
  completedAccounts: number;
  failedAccounts: number;
  startedAt: string | null;
  createdAt: string;
  _count: { enrollments: number };
}

interface Stats {
  totalCohorts: number;
  activeCohorts: number;
  totalEnrollments: number;
  byStatus: Record<string, number>;
  byPlatform: Record<string, number>;
  graduatedLast7Days: number;
  failedLast7Days: number;
}

export default function SeasoningPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const { data: cohortsRes, isLoading: cohortsLoading, error: cohortsError, mutate: mutateCohorts } = useCohorts<CohortRow[]>();
  const { data: statsRes, isLoading: statsLoading, error: statsError } = useSeasoningStats<Stats>();

  const cohorts = cohortsRes?.data ?? [];
  const stats = statsRes?.data;
  const isLoading = cohortsLoading || statsLoading;
  const hasError = cohortsError || statsError;

  const handleCreate = async (data: { name: string; platforms: string[] }) => {
    try {
      const res = await apiPost<{ success: boolean; data: { id: string } }>('/seasoning/cohorts', data);
      toast.success('Cohort created');
      mutateCohorts();
      if (res.data?.id) router.push(`/seasoning/${res.data.id}`);
    } catch (err) {
      console.error('Failed to create cohort:', err);
      toast.error('Failed to create cohort');
      throw new Error('Failed to create cohort');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sprout className="text-accent-green" size={24} />
            <h1 className="text-h2 text-text-primary">Seasoning Pipeline</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            New Cohort
          </button>
        </div>

        {/* Error banner */}
        {hasError && (
          <div className="flex items-center gap-3 p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg">
            <AlertTriangle className="text-accent-red shrink-0" size={20} />
            <p className="text-body text-accent-red">Failed to load seasoning data. Please try again later.</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !hasError && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-bg-secondary border border-border rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-bg-tertiary rounded w-24 mb-2" />
                  <div className="h-6 bg-bg-tertiary rounded w-16" />
                </div>
              ))}
            </div>
            <div className="bg-bg-secondary border border-border rounded-lg p-4 animate-pulse h-24" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-bg-secondary border border-border rounded-lg p-4 animate-pulse h-20" />
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {!isLoading && !hasError && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Users size={18} />} label="Total Enrollments" value={stats.totalEnrollments} />
            <StatCard icon={<Clock size={18} />} label="Active Cohorts" value={stats.activeCohorts} />
            <StatCard icon={<CheckCircle size={18} />} label="Graduated (7d)" value={stats.graduatedLast7Days} color="text-accent-green" />
            <StatCard icon={<XCircle size={18} />} label="Failed (7d)" value={stats.failedLast7Days} color="text-accent-red" />
          </div>
        )}

        {/* Global phase distribution */}
        {!isLoading && !hasError && stats && stats.totalEnrollments > 0 && (
          <div className="bg-bg-secondary border border-border rounded-lg p-4">
            <h3 className="text-body text-text-secondary mb-3">Pipeline Distribution</h3>
            <PhasePipeline phaseCounts={stats.byStatus} total={stats.totalEnrollments} />
          </div>
        )}

        {/* Cohort list */}
        {!isLoading && !hasError && (
          <div className="space-y-3">
            {cohorts.length === 0 ? (
              <div className="text-center py-12 bg-bg-secondary border border-border rounded-lg">
                <Sprout className="mx-auto text-text-secondary mb-3" size={40} />
                <p className="text-body text-text-secondary mb-2">No seasoning cohorts yet</p>
                <p className="text-caption text-text-secondary mb-4">Create a cohort to start seasoning your accounts.</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="btn-primary"
                >
                  Create First Cohort
                </button>
              </div>
            ) : (
              cohorts.map((cohort) => (
                <Link
                  key={cohort.id}
                  href={`/seasoning/${cohort.id}`}
                  className="block bg-bg-secondary border border-border rounded-lg p-4 hover:border-accent-blue/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-card-title text-text-primary">{cohort.name}</h3>
                    <span className={`text-caption px-2 py-0.5 rounded ${
                      cohort.status === 'active' ? 'bg-accent-green/20 text-accent-green' :
                      cohort.status === 'completed' ? 'bg-accent-green/20 text-accent-green' :
                      cohort.status === 'paused' ? 'bg-accent-amber/20 text-accent-amber' :
                      'bg-bg-tertiary text-text-secondary'
                    }`}>
                      {cohort.status}
                    </span>
                  </div>
                  <div className="flex gap-4 text-caption text-text-secondary">
                    <span>{cohort.platforms.map((p) => p.toUpperCase()).join(', ')}</span>
                    <span>{cohort._count.enrollments} accounts</span>
                    <span>{cohort.completedAccounts} graduated</span>
                    {cohort.failedAccounts > 0 && (
                      <span className="text-accent-red">{cohort.failedAccounts} failed</span>
                    )}
                  </div>
                  {/* Mini progress bar */}
                  {cohort._count.enrollments > 0 && (
                    <div className="mt-2 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-green rounded-full transition-all"
                        style={{ width: `${(cohort.completedAccounts / cohort._count.enrollments) * 100}%` }}
                      />
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        )}

        <CreateCohortModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-text-secondary mb-1">
        {icon}
        <span className="text-caption">{label}</span>
      </div>
      <p className={`text-h3 font-semibold ${color ?? 'text-text-primary'}`}>{value}</p>
    </div>
  );
}
