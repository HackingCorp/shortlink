import { useCallback } from 'react';
import { useNotifications } from '@/context/NotificationContext';

type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'loading';

interface NotificationOptions {
  title?: string;
  autoClose?: number | false;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useNotification = () => {
  const { showNotification, dismissNotification } = useNotifications();

  const notify = useCallback(
    (type: NotificationType, message: string, options: NotificationOptions = {}) => {
      return showNotification({
        type,
        message,
        ...options,
      });
    },
    [showNotification]
  );

  const success = useCallback(
    (message: string, options?: Omit<NotificationOptions, 'type'>) => 
      notify('success', message, options),
    [notify]
  );

  const error = useCallback(
    (message: string, options?: Omit<NotificationOptions, 'type'>) => 
      notify('error', message, { autoClose: 10000, ...options }),
    [notify]
  );

  const info = useCallback(
    (message: string, options?: Omit<NotificationOptions, 'type'>) => 
      notify('info', message, options),
    [notify]
  );

  const warning = useCallback(
    (message: string, options?: Omit<NotificationOptions, 'type'>) => 
      notify('warning', message, options),
    [notify]
  );

  const loading = useCallback(
    (message: string, options?: Omit<NotificationOptions, 'type'>) => 
      notify('loading', message, { autoClose: false, ...options }),
    [notify]
  );

  return {
    success,
    error,
    info,
    warning,
    loading,
    dismiss: dismissNotification,
  };
};
