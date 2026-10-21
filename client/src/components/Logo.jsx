import { Link } from 'react-router-dom';

/**
 * The SplitMate wordmark.
 *
 * `variant="stacked"` is the big centred lockup used on the sign-in screens:
 * the name, a rule, and the tagline. `variant="inline"` is the compact mark
 * used in headers and the navigation drawer.
 */
export default function Logo({ to = '/', variant = 'inline', className = '' }) {
  if (variant === 'stacked') {
    return (
      <div className={`text-center ${className}`}>
        <h1 className="text-4xl font-extrabold uppercase leading-none tracking-tight text-brand-700">
          Split<span className="text-brand-600">Mate</span>
        </h1>
        <div className="mt-3 flex items-center justify-center" aria-hidden="true">
          <NoteMark />
        </div>
        <p className="mt-2 text-base font-medium text-brand-600">split bills, pay easy</p>
        <hr className="mx-auto mt-4 w-full max-w-xs border-t border-brand-400/70" />
      </div>
    );
  }

  const mark = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M8 10h16M8 16h16M8 22h8" stroke="#F7FBEC" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="23" cy="22" r="3" fill="#F7FBEC" />
        </svg>
      </span>
      <span className="text-lg font-extrabold uppercase tracking-tight text-brand-700">
        SplitMate
      </span>
    </span>
  );

  return to ? (
    <Link to={to} className="rounded-xl" aria-label="SplitMate home">
      {mark}
    </Link>
  ) : (
    mark
  );
}

/** A small banknote glyph, drawn rather than imported as an asset. */
function NoteMark() {
  return (
    <svg viewBox="0 0 64 34" className="h-8 w-16" fill="none" aria-hidden="true">
      <rect x="1" y="7" width="54" height="24" rx="3" fill="#DCE9B4" stroke="#87A354" strokeWidth="1.5" />
      <rect x="9" y="1" width="54" height="24" rx="3" fill="#EAF2CE" stroke="#6B8A47" strokeWidth="1.5" />
      <circle cx="36" cy="13" r="6" fill="#C6D894" stroke="#6B8A47" strokeWidth="1.5" />
      <path d="M33.5 10h5M33.5 13h5M37 16.5c-1.8 0-3.3-1.3-3.5-3h1.6c.2.9 1 1.5 1.9 1.5" stroke="#587339" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
