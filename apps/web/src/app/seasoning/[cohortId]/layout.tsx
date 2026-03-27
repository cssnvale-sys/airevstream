import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cohort Detail',
  description: 'View cohort enrollments, phase progression, and risk assessments',
};

export default function CohortDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
