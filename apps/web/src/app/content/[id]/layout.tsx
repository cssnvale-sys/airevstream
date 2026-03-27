import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Content Detail',
  description: 'View content details, quality scores, and publishing history',
};

export default function ContentDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
