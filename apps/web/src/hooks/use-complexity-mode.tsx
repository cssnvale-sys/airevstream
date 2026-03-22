'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { STORAGE_KEY, DEFAULT_MODE } from '@/lib/complexity-fields';
import type { ComplexityMode } from '@/lib/complexity-fields';

interface ComplexityContextValue {
  mode: ComplexityMode;
  setMode: (mode: ComplexityMode) => void;
}

const ComplexityContext = createContext<ComplexityContextValue | null>(null);

function isValidMode(v: unknown): v is ComplexityMode {
  return v === 'simple' || v === 'advanced' || v === 'complex';
}

export function ComplexityProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ComplexityMode>(DEFAULT_MODE);

  // Read localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isValidMode(stored)) {
        setModeState(stored);
      }
    } catch {
      // localStorage unavailable (SSR or private browsing)
    }
  }, []);

  const setMode = useCallback((newMode: ComplexityMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <ComplexityContext.Provider value={{ mode, setMode }}>
      {children}
    </ComplexityContext.Provider>
  );
}

export function useComplexityMode(): ComplexityContextValue {
  const ctx = useContext(ComplexityContext);
  if (!ctx) {
    throw new Error('useComplexityMode must be used within ComplexityProvider');
  }
  return ctx;
}
