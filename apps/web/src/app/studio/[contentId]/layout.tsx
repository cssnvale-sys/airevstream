import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Studio Editor',
  description: 'Cinema production studio — edit shots, timeline, and render videos',
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
