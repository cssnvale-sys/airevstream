import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Seasoning Pipeline' };

export default function SeasoningLayout({ children }: { children: React.ReactNode }) {
  return children;
}
