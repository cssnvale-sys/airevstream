import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Content Detail' };

export default function ContentDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
