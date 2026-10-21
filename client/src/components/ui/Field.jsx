import { useId } from 'react';

/**
 * A labelled form control. The label is always a real <label> bound to the
 * input, and an error is announced through aria-describedby + role="alert" so
 * it is not purely a visual signal.
 */
export function Field({ label, error, hint, required, children, className = '', htmlFor }) {
  const generatedId = useId();
  const id = htmlFor || generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
        {required && (
          <span className="ml-1 text-negative" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {typeof children === 'function'
        ? children({ id, describedBy, invalid: Boolean(error) })
        : children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ invalid, className = '', describedBy, ...props }) {
  return (
    <input
      className={`field tap ${invalid ? 'field-error' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );
}

export function TextArea({ invalid, className = '', describedBy, ...props }) {
  return (
    <textarea
      className={`field min-h-[88px] resize-y ${invalid ? 'field-error' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );
}

export function Select({ invalid, className = '', describedBy, children, ...props }) {
  return (
    <select
      className={`field tap appearance-none bg-[length:1.1em] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${
        invalid ? 'field-error' : ''
      } ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235E6B50' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
      }}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * A money input. It keeps the raw text the user typed (so "1,2" mid-typing is
 * not fought with) and leaves conversion to paise to the submit handler.
 */
export function MoneyInput({ invalid, className = '', describedBy, ...props }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
        &#8377;
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        className={`field tabular tap pl-8 ${invalid ? 'field-error' : ''} ${className}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        {...props}
      />
    </div>
  );
}

/**
 * The underlined, icon-led input used on the sign-in and sign-up screens.
 *
 * The visible label is replaced by an icon plus a placeholder, so the real
 * <label> is kept for screen readers rather than dropped - a placeholder alone
 * is not an accessible name, and it vanishes the moment someone types.
 */
export function UnderlineField({ label, error, icon, className = '', children, htmlFor }) {
  const generatedId = useId();
  const id = htmlFor || generatedId;
  const describedBy = error ? `${id}-error` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 border-b-2 pb-1 transition-colors focus-within:border-accent ${
          error ? 'border-negative' : 'border-brand-400/70'
        }`}
      >
        <span className="shrink-0 text-brand-700" aria-hidden="true">
          {icon}
        </span>
        {children({ id, describedBy, invalid: Boolean(error) })}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

export function UnderlineInput({ invalid, className = '', describedBy, ...props }) {
  return (
    <input
      className={`tap w-full border-0 bg-transparent px-0 py-2 text-base text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0 ${className}`}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );
}

export default Field;
