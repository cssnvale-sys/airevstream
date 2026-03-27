'use client';

import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps focus within a container element while active.
 * Tab/Shift+Tab cycle through focusable elements without escaping.
 *
 * @param active - Whether the trap is active (e.g., modal is open)
 * @param options.onEscape - Called when Escape is pressed
 * @param options.disabled - Disables Escape key handling (e.g., during loading)
 */
export function useFocusTrap(
  active: boolean,
  options?: { onEscape?: () => void; disabled?: boolean },
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && options?.onEscape && !options?.disabled) {
        e.preventDefault();
        options.onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [options?.onEscape, options?.disabled],
  );

  useEffect(() => {
    if (!active) return;

    // Save the element that had focus before the trap activated
    previousFocusRef.current = document.activeElement as HTMLElement;

    document.addEventListener('keydown', handleKeyDown);

    // Auto-focus first focusable element if nothing inside is focused
    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first) {
        // Delay to ensure DOM is painted
        const timer = setTimeout(() => first.focus(), 50);
        return () => {
          clearTimeout(timer);
          document.removeEventListener('keydown', handleKeyDown);
        };
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the previously focused element
      previousFocusRef.current?.focus();
    };
  }, [active, handleKeyDown]);

  return containerRef;
}
