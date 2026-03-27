'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

export function LoadingButton({
  loading = false,
  loadingText,
  children,
  className,
  disabled,
  type = 'button',
  ...props
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      className={cn(className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          {loadingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
