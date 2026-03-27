import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Configure account preferences, AI services, and system settings',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
