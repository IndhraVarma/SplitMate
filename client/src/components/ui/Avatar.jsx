import { initials } from '../../utils/format.js';

const SIZES = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };

/** Initials on the user's own colour - no uploads, no external avatar service. */
export default function Avatar({ name, color = '#10b981', size = 'md', className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${
        SIZES[size] || SIZES.md
      } ${className}`}
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people = [], max = 4, size = 'sm' }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => (
        <Avatar
          key={p.userId || p.id || p.name}
          name={p.name}
          color={p.avatarColor}
          size={size}
          className="ring-2 ring-surface-raised"
        />
      ))}
      {extra > 0 && (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted text-xs font-semibold text-brand-700 ring-2 ring-surface-raised">
          +{extra}
        </span>
      )}
    </div>
  );
}
