import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Track engagement metrics, revenue, and content performance across platforms',
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
