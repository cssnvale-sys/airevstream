'use client';

import type { ReactNode } from 'react';
import { ComplexityProvider } from '@/hooks/use-complexity-mode';
import { ThemeProvider } from '@/hooks/use-theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ComplexityProvider>{children}</ComplexityProvider>
    </ThemeProvider>
  );
}
