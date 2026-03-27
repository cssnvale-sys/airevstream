import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Affiliate Manager',
  description: 'Manage affiliate products, track revenue, and optimize link placements',
};

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
