/** A helpful empty state: says what is missing and offers the next action. */
export default function EmptyState({ title, description, action, icon = 'list', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-surface-border bg-surface-overlay text-accent">
        <EmptyIcon name={icon} />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function EmptyIcon({ name }) {
  const paths = {
    list: 'M4 6h16M4 12h16M4 18h10',
    wallet: 'M3 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 4h3v4h-3a2 2 0 010-4z',
    group: 'M17 20h5v-1a4 4 0 00-4-4M9 20H2v-1a5 5 0 015-5h2a5 5 0 015 5v1H9zm3-12a3 3 0 11-6 0 3 3 0 016 0zm7 1a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
    chart: 'M4 19V9m6 10V5m6 14v-6M3 21h18',
    check: 'M5 13l4 4L19 7',
    search: 'M21 21l-4.3-4.3M17 10a7 7 0 11-14 0 7 7 0 0114 0z',
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name] || paths.list} />
    </svg>
  );
}
