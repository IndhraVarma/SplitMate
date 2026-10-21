import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import Spinner from './Spinner.jsx';

const VARIANTS = {
  primary: 'bg-accent text-ink-onAccent hover:bg-accent-strong active:bg-accent-strong shadow-sm',
  secondary:
    'bg-surface-raised text-ink border border-surface-border hover:border-accent hover:text-brand-700',
  ghost: 'text-ink-muted hover:bg-surface-overlay hover:text-brand-700',
  danger: 'bg-negative/10 text-negative border border-negative/30 hover:bg-negative/20',
  subtle: 'bg-accent-soft text-brand-700 border border-accent/30 hover:bg-accent-muted',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2 tap',
  lg: 'px-5 py-3 text-base rounded-xl gap-2 tap',
};

/**
 * One button for the whole app. Renders an <a>, a react-router <Link> or a
 * <button> depending on the props, so navigation stays keyboard-accessible.
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    children,
    to,
    href,
    type = 'button',
    ...props
  },
  ref
) {
  const classes = [
    'inline-flex items-center justify-center font-semibold transition-colors',
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ');

  const content = (
    <>
      {loading && <Spinner size="sm" className="shrink-0" />}
      {children}
    </>
  );

  if (to && !disabled) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  if (href && !disabled) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  );
});

export default Button;
