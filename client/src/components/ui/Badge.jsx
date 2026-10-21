const TONES = {
  neutral: 'bg-surface-overlay text-ink-muted border-surface-border',
  accent: 'bg-accent/10 text-accent border-accent/30',
  positive: 'bg-positive/10 text-positive border-positive/30',
  negative: 'bg-negative/10 text-negative border-negative/30',
  caution: 'bg-caution/10 text-caution border-caution/30',
};

export default function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        TONES[tone] || TONES.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}
