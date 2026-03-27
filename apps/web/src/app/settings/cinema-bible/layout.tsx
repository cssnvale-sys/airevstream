import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cinema Bible',
  description: 'Define visual identity, character styles, and production guidelines',
};

export default function CinemaBibleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
