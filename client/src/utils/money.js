/**
 * Client-side money helpers.
 *
 * The rules themselves live in /shared, which the API imports too - this file
 * only re-exports them plus a few display conveniences. There is deliberately
 * no second implementation of rounding or splitting in the browser.
 */
export {
  toPaise,
  fromPaise,
  formatMoney,
  formatMoneyAbs,
  paiseToInputString,
  sumPaise,
  MoneyError,
} from '@shared/money.js';

export {
  computeShares,
  splitEqually,
  splitExactly,
  splitByPercentage,
  percentToBasisPoints,
  basisPointsToPercent,
  BASIS_POINTS_TOTAL,
} from '@shared/split.js';

import { formatMoney } from '@shared/money.js';

/** "+₹1,200.00" / "-₹1,200.00" - used wherever direction matters. */
export function formatSigned(paise) {
  return formatMoney(paise, { signDisplay: 'always' });
}

/** Compact form for dashboard tiles: ₹1.2L, ₹45.3K. */
export function formatCompact(paise) {
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? '-' : '';
  if (rupees >= 10000000) return `${sign}\u20B9${(rupees / 10000000).toFixed(2)}Cr`;
  if (rupees >= 100000) return `${sign}\u20B9${(rupees / 100000).toFixed(2)}L`;
  if (rupees >= 1000) return `${sign}\u20B9${(rupees / 1000).toFixed(1)}K`;
  return formatMoney(paise);
}

/** Basis points (2500) -> a percentage label ("25%", "33.33%"). */
export function formatBasisPoints(bp) {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** Recharts needs plain rupee numbers; this is display data, never ledger math. */
export function toChartValue(paise) {
  return Math.round(paise) / 100;
}
