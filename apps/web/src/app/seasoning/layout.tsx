import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seasoning Pipeline',
  description: 'Manage account warm-up cohorts and enrollment progression',
};

export default function SeasoningLayout({ children }: { children: React.ReactNode }) {
  return children;
}
