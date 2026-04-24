import { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationsContext = createContext(null);

let idCounter = 0;

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef({});

  const addNotification = useCallback((notification) => {
    const id = ++idCounter;
    const item = {
      id,
      type: notification.type || 'info', // info | success | warning | error
      title: notification.title,
      message: notification.message || '',
      duration: notification.duration ?? 4000,
    };

    setNotifications((prev) => [...prev, item]);

    if (item.duration > 0) {
      timersRef.current[id] = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        delete timersRef.current[id];
      }, item.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const notify = {
    success: (title, message) => addNotification({ type: 'success', title, message }),
    error: (title, message) => addNotification({ type: 'error', title, message, duration: 6000 }),
    warning: (title, message) => addNotification({ type: 'warning', title, message, duration: 5000 }),
    info: (title, message) => addNotification({ type: 'info', title, message }),
  };

  return (
    <NotificationsContext.Provider value={{ notifications, addNotification, removeNotification, notify }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
