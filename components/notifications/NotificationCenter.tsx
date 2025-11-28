import React, { useEffect } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { X, CheckCircle, AlertCircle, Info, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

export const NotificationCenter: React.FC = () => {
  const { notifications, dismissNotification } = useNotifications();

  // Auto-dismiss notifications when they're added
  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.autoClose !== false && !('autoClose' in notification)) {
        const timer = setTimeout(
          () => dismissNotification(notification.id),
          notification.type === 'error' ? 10000 : 5000
        );
        return () => clearTimeout(timer);
      }
    });
  }, [notifications, dismissNotification]);

  const getNotificationStyles = (type: string) => {
    const baseStyles = 'p-4 rounded-lg shadow-lg max-w-md w-full flex items-start space-x-3';
    
    const typeStyles = {
      success: 'bg-green-50 text-green-800 border border-green-200',
      error: 'bg-red-50 text-red-800 border border-red-200',
      warning: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
      info: 'bg-blue-50 text-blue-800 border border-blue-200',
      loading: 'bg-gray-50 text-gray-800 border border-gray-200',
    }[type] || 'bg-white text-gray-800 border border-gray-200';

    return cn(baseStyles, typeStyles);
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 w-full max-w-md">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            layout
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className={getNotificationStyles(notification.type)}
          >
            <div className="flex-shrink-0">
              {React.createElement(iconMap[notification.type] || Info, {
                className: 'h-5 w-5',
                'aria-hidden': true,
              })}
            </div>
            <div className="flex-1 min-w-0">
              {notification.title && (
                <h3 className="text-sm font-medium">
                  {notification.title}
                </h3>
              )}
              <p className="text-sm">{notification.message}</p>
              {notification.action && (
                <button
                  type="button"
                  onClick={() => {
                    notification.action?.onClick();
                    dismissNotification(notification.id);
                  }}
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-500"
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(notification.id)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Fermer</span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
