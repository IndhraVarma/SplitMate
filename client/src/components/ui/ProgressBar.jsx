/**
 * Budget progress. The value arrives in basis points from the API so the
 * browser never divides money - it only clamps for display.
 */
export default function ProgressBar({ basisPoints = 0, over = false, label, className = '' }) {
  const percent = Math.min(100, Math.max(0, basisPoints / 100));
  const tone = over ? 'bg-negative' : percent >= 80 ? 'bg-caution' : 'bg-accent';
  return (
    <div className={className}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Budget used'}
      >
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
