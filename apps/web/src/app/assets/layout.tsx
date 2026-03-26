import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Assets — AiRevStream',
  description: 'Manage characters, backgrounds, and branding assets',
};

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
