'use client';

import { useState } from 'react';
import { useCohorts, useSeasoningStats } from '@/hooks/use-seasoning';
import { apiPost } from '@/hooks/use-api';
import { CreateCohortModal } from '@/components/seasoning/create-cohort-modal';
import { PhasePipeline } from '@/components/seasoning/phase-pipeline';
import Link from 'next/link';
import { Sprout, Plus, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

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
  const [showCreate, setShowCreate] = useState(false);
  const { data: cohortsRes, mutate: mutateCohorts } = useCohorts<CohortRow[]>();
  const { data: statsRes } = useSeasoningStats<Stats>();

  const cohorts = cohortsRes?.data ?? [];
  const stats = statsRes?.data;

  const handleCreate = async (data: { name: string; platforms: string[] }) => {
    try {
      await apiPost('/seasoning/cohorts', data);
      toast.success('Cohort created');
      mutateCohorts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create cohort');
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sprout className="text-green-400" size={24} />
          <h1 className="text-h2 text-text-primary">Seasoning Pipeline</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent-blue text-white hover:bg-accent-blue/80 text-body"
        >
          <Plus size={16} />
          New Cohort
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users size={18} />} label="Total Enrollments" value={stats.totalEnrollments} />
          <StatCard icon={<Clock size={18} />} label="Active Cohorts" value={stats.activeCohorts} />
          <StatCard icon={<CheckCircle size={18} />} label="Graduated (7d)" value={stats.graduatedLast7Days} color="text-green-400" />
          <StatCard icon={<XCircle size={18} />} label="Failed (7d)" value={stats.failedLast7Days} color="text-red-400" />
        </div>
      )}

      {/* Global phase distribution */}
      {stats && stats.totalEnrollments > 0 && (
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-body text-text-secondary mb-3">Pipeline Distribution</h3>
          <PhasePipeline phaseCounts={stats.byStatus} total={stats.totalEnrollments} />
        </div>
      )}

      {/* Cohort list */}
      <div className="space-y-3">
        {cohorts.length === 0 ? (
          <div className="text-center py-12 bg-bg-secondary border border-border rounded-lg">
            <Sprout className="mx-auto text-text-secondary mb-3" size={40} />
            <p className="text-body text-text-secondary mb-2">No seasoning cohorts yet</p>
            <p className="text-caption text-text-secondary mb-4">Create a cohort to start seasoning your accounts.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-md bg-accent-blue text-white hover:bg-accent-blue/80 text-body"
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
                  cohort.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  cohort.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                  cohort.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
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
                  <span className="text-red-400">{cohort.failedAccounts} failed</span>
                )}
              </div>
              {/* Mini progress bar */}
              {cohort.totalAccounts > 0 && (
                <div className="mt-2 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(cohort.completedAccounts / cohort.totalAccounts) * 100}%` }}
                  />
                </div>
              )}
            </Link>
          ))
        )}
      </div>

      <CreateCohortModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
    </div>
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
