import Button from './Button.jsx';

/** Shown when a screen fails to load. Always offers a way forward. */
export default function ErrorState({ error, onRetry, title = 'Could not load this' }) {
  const message =
    (error && error.message) || 'Something went wrong while loading. Please try again.';
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-negative/30 bg-negative/5 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-negative/15 text-negative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={() => onRetry()}>
          Try again
        </Button>
      )}
    </div>
  );
}
