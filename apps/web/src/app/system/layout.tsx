import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Health',
  description: 'Monitor infrastructure services, database connections, and API status',
};

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
