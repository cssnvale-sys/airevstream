import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Channels',
  description: 'Manage social media channels, niche topics, and viral performance',
};

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
