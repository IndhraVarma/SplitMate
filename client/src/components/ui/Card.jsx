export function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`card p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default Card;
