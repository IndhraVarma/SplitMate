export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Placeholder rows matching the shape of a transaction / expense list. */
export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-surface-border p-3.5">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = '' }) {
  return (
    <div className={`card space-y-3 p-5 ${className}`} role="status" aria-label="Loading">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export default Skeleton;
