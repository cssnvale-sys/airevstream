import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Cohort Detail' };

export default function CohortDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
