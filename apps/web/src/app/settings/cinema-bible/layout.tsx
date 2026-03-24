import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Cinema Bible' };

export default function CinemaBibleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
