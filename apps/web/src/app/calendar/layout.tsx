import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calendar',
  description: 'Schedule and visualize content publishing across all platforms',
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
