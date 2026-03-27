import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Content',
  description: 'Generate AI-powered content with visual presets, audio, and camera controls',
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
