import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Content Library',
  description: 'Browse, search, and manage all generated content items',
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
