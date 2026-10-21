import { useNavigate } from 'react-router-dom';
import NavIcon from '../components/NavIcon.jsx';

/** Consistent screen heading, with an optional back button and action slot. */
export default function PageHeader({ title, subtitle, action, backTo, className = '' }) {
  const navigate = useNavigate();
  return (
    <header className={`mb-5 ${className}`}>
      {backTo !== undefined && (
        <button
          type="button"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="mb-3 -ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-ink-muted hover:text-accent"
        >
          <NavIcon name="back" className="h-4 w-4" />
          Back
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
