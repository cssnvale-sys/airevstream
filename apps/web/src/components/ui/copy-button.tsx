'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  size?: number;
  showToast?: boolean;
}

export function CopyButton({ value, label, className, size = 14, showToast = true }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (showToast) toast.success('Copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [value, showToast]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleCopy();
      }}
      title={label ?? 'Copy to clipboard'}
      className={cn(
        'inline-flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors p-1 rounded',
        copied && 'text-accent-green',
        className,
      )}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}
