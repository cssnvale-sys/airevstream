import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Approvals',
  description: 'Review and approve or reject AI-generated content before publishing',
};

export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
