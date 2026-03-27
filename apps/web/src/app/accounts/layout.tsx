import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accounts',
  description: 'Manage social media accounts, proxies, and authentication credentials',
};

export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
