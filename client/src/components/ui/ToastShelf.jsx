const TONES = {
  success: 'border-positive/40 bg-positive/10 text-positive',
  error: 'border-negative/40 bg-negative/10 text-negative',
  info: 'border-surface-border bg-surface-raised text-ink',
};

/**
 * Toasts live above the bottom navigation on phones and bottom-right on
 * desktop. The region is polite so a screen reader announces it without
 * interrupting whatever the user is doing.
 */
export default function ToastShelf({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4 sm:right-6 sm:left-auto sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lift backdrop-blur ${
            TONES[toast.variant] || TONES.info
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="-m-1 rounded p-1 opacity-70 hover:opacity-100"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M6.3 5a.9.9 0 00-1.3 1.3L8.7 10l-3.7 3.7A.9.9 0 106.3 15l3.7-3.7 3.7 3.7a.9.9 0 001.3-1.3L11.3 10 15 6.3A.9.9 0 0013.7 5L10 8.7 6.3 5z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
