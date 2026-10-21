import Button from './Button.jsx';

export default function Pagination({ meta, onChange, className = '' }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav
      className={`flex items-center justify-between gap-3 pt-2 ${className}`}
      aria-label="Pagination"
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={!meta.hasPreviousPage}
        onClick={() => onChange(meta.page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm text-ink-muted">
        Page {meta.page} of {meta.totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={!meta.hasNextPage}
        onClick={() => onChange(meta.page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
