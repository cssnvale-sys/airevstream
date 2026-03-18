'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (showToast) toast.success('Copied!');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
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
      aria-label={label ?? 'Copy to clipboard'}
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
