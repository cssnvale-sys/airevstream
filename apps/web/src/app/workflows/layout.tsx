import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workflows',
  description: 'Monitor BullMQ job queues, worker status, and pipeline throughput',
};

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
