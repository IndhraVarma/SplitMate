import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import ToastShelf from '../components/ui/ToastShelf.jsx';

const ToastContext = createContext(null);

/** Transient feedback for actions that succeed or fail. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, { variant = 'info', duration = 4500 } = {}) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((current) => [...current, { id, message, variant }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, variant: 'success' }),
      error: (message, options) => push(message, { ...options, variant: 'error' }),
      info: (message, options) => push(message, { ...options, variant: 'info' }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastShelf toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider.');
  return ctx;
}

export default ToastContext;
