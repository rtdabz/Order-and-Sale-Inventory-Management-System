import { toast as sonnerToast } from 'sonner';

// Keep track of active toasts to reuse their IDs
const activeToasts = new Map<string, string | number>();

interface ToastOptions {
  id?: string;
  duration?: number;
  [key: string]: any;
}

// Default toast function (info/standard)
const toastFn = (message: string, options: ToastOptions = {}) => {
  const key = options.id || message;
  const existingId = activeToasts.get(key);
  const toastId = sonnerToast(message, {
    ...options,
    id: existingId,
    onDismiss: () => {
      activeToasts.delete(key);
      options.onDismiss?.();
    },
    onAutoClose: () => {
      activeToasts.delete(key);
      options.onAutoClose?.();
    },
  });
  activeToasts.set(key, toastId);
  return toastId;
};

// Attach properties to the function
export const toast = Object.assign(toastFn, {
  success: (message: string, options: ToastOptions = {}) => {
    const key = options.id || message;
    const existingId = activeToasts.get(key);
    const toastId = sonnerToast.success(message, {
      ...options,
      id: existingId,
      onDismiss: () => {
        activeToasts.delete(key);
        options.onDismiss?.();
      },
      onAutoClose: () => {
        activeToasts.delete(key);
        options.onAutoClose?.();
      },
    });
    activeToasts.set(key, toastId);
    return toastId;
  },
  error: (message: string, options: ToastOptions = {}) => {
    const key = options.id || message;
    const existingId = activeToasts.get(key);
    const toastId = sonnerToast.error(message, {
      ...options,
      id: existingId,
      onDismiss: () => {
        activeToasts.delete(key);
        options.onDismiss?.();
      },
      onAutoClose: () => {
        activeToasts.delete(key);
        options.onAutoClose?.();
      },
    });
    activeToasts.set(key, toastId);
    return toastId;
  },
  warning: (message: string, options: ToastOptions = {}) => {
    const key = options.id || message;
    const existingId = activeToasts.get(key);
    const toastId = sonnerToast.warning(message, {
      ...options,
      id: existingId,
      onDismiss: () => {
        activeToasts.delete(key);
        options.onDismiss?.();
      },
      onAutoClose: () => {
        activeToasts.delete(key);
        options.onAutoClose?.();
      },
    });
    activeToasts.set(key, toastId);
    return toastId;
  },
  info: (message: string, options: ToastOptions = {}) => {
    const key = options.id || message;
    const existingId = activeToasts.get(key);
    const toastId = sonnerToast.info ? sonnerToast.info(message, {
      ...options,
      id: existingId,
      onDismiss: () => {
        activeToasts.delete(key);
        options.onDismiss?.();
      },
      onAutoClose: () => {
        activeToasts.delete(key);
        options.onAutoClose?.();
      },
    }) : sonnerToast(message, {
      ...options,
      id: existingId,
      onDismiss: () => {
        activeToasts.delete(key);
        options.onDismiss?.();
      },
      onAutoClose: () => {
        activeToasts.delete(key);
        options.onAutoClose?.();
      },
    });
    activeToasts.set(key, toastId);
    return toastId;
  },
});
