import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemAlertProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
  onClose?: () => void;
  className?: string;
}

const alertConfig = {
  info: {
    icon: Info,
    className: "border-kutlwano-blue/20 bg-kutlwano-blue/5 text-kutlwano-blue",
    iconClassName: "text-kutlwano-blue"
  },
  success: {
    icon: CheckCircle,
    className: "border-green-500/20 bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-400",
    iconClassName: "text-green-600 dark:text-green-400"
  },
  warning: {
    icon: AlertCircle,
    className: "border-yellow-500/20 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400",
    iconClassName: "text-yellow-600 dark:text-yellow-400"
  },
  error: {
    icon: XCircle,
    className: "border-red-500/20 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-400",
    iconClassName: "text-red-600 dark:text-red-400"
  }
};

export const SystemAlert: React.FC<SystemAlertProps> = ({
  type,
  title,
  message,
  duration = 5000,
  onClose,
  className
}) => {
  const config = alertConfig[type];
  const Icon = config.icon;

  React.useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <Alert className={cn(config.className, className)}>
      <Icon className={cn("h-4 w-4", config.iconClassName)} />
      <AlertDescription>
        {title && (
          <div className="font-semibold mb-1">{title}</div>
        )}
        <div>{message}</div>
      </AlertDescription>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 hover:bg-black/5 rounded transition-colors"
        >
          <XCircle className="h-4 w-4 opacity-60" />
        </button>
      )}
    </Alert>
  );
};