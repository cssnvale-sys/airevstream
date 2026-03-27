import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Budgets',
  description: 'Set and track cost budgets for AI generation and production pipelines',
};

export default function BudgetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
