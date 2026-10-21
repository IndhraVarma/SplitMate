import { Link } from 'react-router-dom';
import { formatMoney } from '../../utils/money.js';
import { titleCase, formatRelativeDay } from '../../utils/format.js';

/**
 * One line in the activity list.
 *
 * Money out is a red amount with an up arrow (leaving you); money in is a green
 * amount with a down arrow (coming to you). The arrow carries a text label for
 * screen readers, so the meaning is never colour-only.
 *
 * The whole row is a link, so the touch target is the full width of the screen.
 */
export default function TransactionRow({ transaction, showDate = true }) {
  const isIncome = transaction.type === 'income';

  return (
    <li className="row-divider last:border-b-0">
      <Link
        to={`/app/transactions/${transaction.id}/edit`}
        className="flex items-center gap-3.5 px-3 py-3.5 transition-colors hover:bg-surface-overlay"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center ${
            isIncome ? 'text-positive' : 'text-ink'
          }`}
        >
          <span className="sr-only">{isIncome ? 'Money in:' : 'Money out:'}</span>
          <ArrowGlyph up={!isIncome} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold uppercase tracking-wide text-ink">
            {transaction.description || titleCase(transaction.category)}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-faint">
            {titleCase(transaction.category)}
            {showDate && ` · ${formatRelativeDay(transaction.date)}`}
            {transaction.paymentMethod && transaction.paymentMethod !== 'other'
              ? ` · ${titleCase(transaction.paymentMethod)}`
              : ''}
          </span>
        </span>

        <span
          className={`tabular shrink-0 text-sm font-bold ${
            isIncome ? 'text-positive' : 'text-negative'
          }`}
        >
          {isIncome ? '+' : '-'}
          {formatMoney(transaction.amountPaise)}
        </span>
      </Link>
    </li>
  );
}

function ArrowGlyph({ up }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {up ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m0 0l-6 6m6-6l6 6" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l6-6m-6 6l-6-6" />
      )}
    </svg>
  );
}
