import { toast as sonnerToast, type ExternalToast } from 'sonner';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions extends ExternalToast {
  /** Auto-dismiss after milliseconds (default: 4000) */
  duration?: number;
  /** Show close button */
  closeButton?: boolean;
}

/**
 * Enhanced toast notification system
 */
export const toast = {
  success(message: string, options?: ToastOptions) {
    sonnerToast.success(message, { 
      duration: 4000,
      closeButton: true,
      ...options 
    });
  },
  
  error(message: string, options?: ToastOptions) {
    sonnerToast.error(message, { 
      duration: 6000, // Errors stay longer
      closeButton: true,
      ...options 
    });
  },
  
  info(message: string, options?: ToastOptions) {
    sonnerToast.info(message, { 
      duration: 4000,
      closeButton: true,
      ...options 
    });
  },
  
  warning(message: string, options?: ToastOptions) {
    sonnerToast.warning(message, { 
      duration: 5000,
      closeButton: true,
      ...options 
    });
  },
  
  /**
   * Show a toast that tracks a promise lifecycle:
   * loading → success or error.
   */
  promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
    options?: ToastOptions
  ): Promise<T> {
    sonnerToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
      ...options,
    });
    return promise;
  },
  
  /**
   * Show a confirmation toast with undo action
   */
  confirm<T>(
    message: string,
    onConfirm: () => Promise<T>,
    onUndo?: () => void
  ): Promise<T> {
    const promise = onConfirm();
    sonnerToast.promise(promise, {
      loading: 'Processing...',
      success: onUndo ? {
        message: `${message} (Click to undo)`,
        action: {
          label: 'Undo',
          onClick: onUndo,
        },
      } : message,
      error: 'Action failed. Please try again.',
    });
    return promise;
  },
  
  /** Dismiss all toasts */
  dismiss() {
    sonnerToast.dismiss();
  },
  
  /** Dismiss a specific toast by ID */
  dismissById(id: string | number) {
    sonnerToast.dismiss(id);
  },
};
