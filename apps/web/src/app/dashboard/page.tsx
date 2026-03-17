'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { content, accounts, workflows } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { FileText, Users, GitBranch, TrendingUp } from 'lucide-react';

interface Stats {
  contentCount: number;
  accountCount: number;
  workflowCount: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ contentCount: 0, accountCount: 0, workflowCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      content.list(token, 1, 1).catch(() => ({ data: { total: 0 } })),
      accounts.list(token, 1, 1).catch(() => ({ data: { total: 0 } })),
      workflows.list(token, 1, 1).catch(() => ({ data: { total: 0 } })),
    ]).then(([c, a, w]) => {
      setStats({
        contentCount: c.data?.total ?? 0,
        accountCount: a.data?.total ?? 0,
        workflowCount: w.data?.total ?? 0,
      });
      setLoading(false);
    });
  }, []);

  const statCards = [
    { label: 'Content Items', value: stats.contentCount, icon: FileText, color: 'text-blue-400' },
    { label: 'Accounts', value: stats.accountCount, icon: Users, color: 'text-green-400' },
    { label: 'Workflows', value: stats.workflowCount, icon: GitBranch, color: 'text-purple-400' },
    { label: 'Published', value: '-', icon: TrendingUp, color: 'text-orange-400' },
  ];

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your content automation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? '...' : card.value}
                  </p>
                </div>
                <Icon className={card.color} size={24} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/content" className="block p-3 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors">
              <p className="font-medium">Create New Content</p>
              <p className="text-sm text-gray-400">Start a new content piece</p>
            </a>
            <a href="/chat" className="block p-3 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors">
              <p className="font-medium">AI Assistant</p>
              <p className="text-sm text-gray-400">Get help planning content</p>
            </a>
            <a href="/workflows" className="block p-3 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors">
              <p className="font-medium">Run Workflow</p>
              <p className="text-sm text-gray-400">Execute an automation workflow</p>
            </a>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">API Server</span>
              <span className="flex items-center gap-2 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Running
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">AI Assistant</span>
              <span className="flex items-center gap-2 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Running
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Workers</span>
              <span className="flex items-center gap-2 text-yellow-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                Check Needed
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
