import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Experiments',
  description: 'Run A/B tests on content variants and track statistical significance',
};

export default function ExperimentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
