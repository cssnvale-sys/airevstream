'use client';

import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook that warns users when they try to leave the page with unsaved changes.
 * Shows a browser-native confirmation dialog on beforeunload.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (isDirtyRef.current) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);
}
