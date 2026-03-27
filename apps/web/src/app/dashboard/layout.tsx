import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Overview of pending approvals, recent activity, and content pipeline status',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
