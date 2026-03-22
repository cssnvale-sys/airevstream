'use client';

import type { ReactNode } from 'react';
import { ComplexityProvider } from '@/hooks/use-complexity-mode';

export function Providers({ children }: { children: ReactNode }) {
  return <ComplexityProvider>{children}</ComplexityProvider>;
}
