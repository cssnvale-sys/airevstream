import { toast as sonnerToast, type ExternalToast } from 'sonner';

export const toast = {
  success(message: string, options?: ExternalToast) {
    sonnerToast.success(message, options);
  },
  error(message: string, options?: ExternalToast) {
    sonnerToast.error(message, options);
  },
  info(message: string, options?: ExternalToast) {
    sonnerToast.info(message, options);
  },
  warning(message: string, options?: ExternalToast) {
    sonnerToast.warning(message, options);
  },
  /**
   * Show a toast that tracks a promise lifecycle:
   * loading → success or error.
   */
  promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
  ): Promise<T> {
    sonnerToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
    return promise;
  },
};
