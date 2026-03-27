import { toast as sonnerToast } from 'sonner';

export const toast = {
  success(message: string) {
    sonnerToast.success(message);
  },
  error(message: string) {
    sonnerToast.error(message);
  },
  info(message: string) {
    sonnerToast.info(message);
  },
  warning(message: string) {
    sonnerToast.warning(message);
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
