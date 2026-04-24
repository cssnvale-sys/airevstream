/**
 * Confirmation dialog component for destructive actions
 */

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'bg-accent-red/10 text-accent-red',
      confirm: 'btn-danger',
    },
    warning: {
      icon: 'bg-accent-yellow/10 text-accent-yellow',
      confirm: 'bg-accent-yellow hover:bg-accent-yellow/90 text-black',
    },
    info: {
      icon: 'bg-accent-blue/10 text-accent-blue',
      confirm: 'btn-primary',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="relative bg-bg-primary rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mb-4', styles.icon)}>
          <AlertTriangle size={24} />
        </div>

        {/* Content */}
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          {title}
        </h2>
        <p className="text-text-secondary mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(styles.confirm, 'min-w-[100px]')}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for using confirmation dialogs
 */
import { useState, useCallback } from 'react';

interface UseConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface UseConfirmReturn {
  ConfirmDialog: React.FC<{
    onConfirm: () => void | Promise<void>;
  }>;
  confirm: () => Promise<boolean>;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export function useConfirm(options: UseConfirmOptions): UseConfirmReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(false);
  }, [resolveRef]);

  const confirm = useCallback(() => {
    open();
    return new Promise<boolean>((resolve) => {
      setResolveRef(() => resolve);
    });
  }, [open]);

  const handleConfirm = useCallback(async () => {
    resolveRef?.(true);
    setIsOpen(false);
  }, [resolveRef]);

  const ConfirmDialogComponent = useCallback(({ onConfirm }: { onConfirm: () => void | Promise<void> }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleConfirm = async () => {
      setIsLoading(true);
      try {
        await onConfirm();
        resolveRef?.(true);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <ConfirmDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        variant={options.variant}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={close}
      />
    );
  }, [isOpen, options, close, resolveRef]);

  return {
    ConfirmDialog: ConfirmDialogComponent,
    confirm,
    isOpen,
    open,
    close,
  };
}
