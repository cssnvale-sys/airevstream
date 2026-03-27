import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Series',
  description: 'Organize content into series with episodes and scheduling',
};

export default function SeriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
