import React, { useState, useEffect } from 'react';
import './BackendRestartNotification.css';

interface BackendRestartNotificationProps {
  isOpen: boolean;
  retryCount: number;
}

export const BackendRestartNotification: React.FC<BackendRestartNotificationProps> = ({
  isOpen,
  retryCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="backend-restart-notification">
      <div className="notification-content">
        <div className="refresh-icon" />
        <div className="notification-text">
          <strong>Backend is restarting</strong> (attempt {retryCount})...
          <br />
          <small>Please wait, we'll reconnect automatically.</small>
        </div>
      </div>
    </div>
  );
};

// Global state for backend restart notification
let notificationListeners: ((isOpen: boolean, retryCount: number) => void)[] = [];
let isNotificationOpen = false;
let currentRetryCount = 0;

export const notifyBackendRestart = (isOpen: boolean, retryCount: number = 0) => {
  isNotificationOpen = isOpen;
  currentRetryCount = retryCount;
  notificationListeners.forEach(listener => listener(isOpen, retryCount));
};

export const useBackendRestartNotification = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const listener = (open: boolean, count: number) => {
      setIsOpen(open);
      setRetryCount(count);
    };

    notificationListeners.push(listener);

    // Set initial state
    setIsOpen(isNotificationOpen);
    setRetryCount(currentRetryCount);

    return () => {
      notificationListeners = notificationListeners.filter(l => l !== listener);
    };
  }, []);

  return { isOpen, retryCount };
};
