import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * A dialog that traps focus, closes on Escape, restores focus to whatever
 * opened it, and locks background scrolling. On phones it slides up from the
 * bottom as a sheet; on wider screens it is a centred dialog.
 */
export default function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const timer = setTimeout(() => {
      const target = panelRef.current?.querySelector('[data-autofocus]') || panelRef.current;
      target?.focus();
    }, 20);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      clearTimeout(timer);
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative z-10 max-h-[92vh] w-full animate-slide-up overflow-y-auto rounded-t-3xl border border-surface-border bg-surface-raised shadow-lift sm:rounded-2xl ${
          widths[size] || widths.md
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-surface-border bg-surface-raised px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-m-1 shrink-0 rounded-lg p-2 text-ink-muted hover:bg-surface-overlay hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M6.3 5a.9.9 0 00-1.3 1.3L8.7 10l-3.7 3.7A.9.9 0 106.3 15l3.7-3.7 3.7 3.7a.9.9 0 001.3-1.3L11.3 10 15 6.3A.9.9 0 0013.7 5L10 8.7 6.3 5z" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 border-t border-surface-border bg-surface-raised px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
