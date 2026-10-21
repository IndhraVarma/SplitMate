/** Segmented control used for period pickers and split-type selection. */
export default function Tabs({ value, onChange, options, className = '', ariaLabel = 'Options' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex w-full gap-1 rounded-xl border border-surface-border bg-surface-overlay p-1 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              selected
                ? 'bg-accent text-ink-onAccent'
                : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
