import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Affiliate Manager' };

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
