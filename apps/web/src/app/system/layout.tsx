import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'System Health' };

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
