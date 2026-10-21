/**
 * Centralised money handling for SplitMate.
 *
 * AUTHORITATIVE REPRESENTATION: every monetary value in the database, the API
 * and these helpers is an INTEGER NUMBER OF PAISE (1 rupee = 100 paise).
 * Floating point is used only at the very edges: parsing user input and
 * rendering a string. No business rule ever adds or divides a float.
 *
 * Why paise: 0.1 + 0.2 !== 0.3 in IEEE-754, so a float ledger silently drifts.
 * Integers are exact, and JS integers are safe up to 2^53-1 — about
 * 90,071,992,547,409 rupees — far beyond anything this product needs.
 */

/** Smallest unit per major unit. Kept as a constant so other currencies can be added. */
export const MINOR_UNITS_PER_MAJOR = 100;

export const CURRENCIES = {
  INR: { code: 'INR', symbol: '\u20B9', locale: 'en-IN', minorUnits: 100 },
};

export const DEFAULT_CURRENCY = 'INR';

export class MoneyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** True when `value` is a safe integer number (our paise invariant). */
export function isPaise(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Throws unless `value` is a valid paise integer. */
export function assertPaise(value, label = 'amount') {
  if (!isPaise(value)) {
    throw new MoneyError(`${label} must be an integer number of paise, received: ${String(value)}`);
  }
  return value;
}

/**
 * Convert a user-supplied rupee value ("1,234.56", 1234.56, "1234") to paise.
 * Rounds half-away-from-zero at the paise boundary, so 0.005 -> 1 paise.
 * Returns an integer; throws MoneyError on anything unparseable.
 */
export function toPaise(rupees) {
  if (rupees === null || rupees === undefined || rupees === '') {
    throw new MoneyError('amount is required');
  }
  let normalised;
  if (typeof rupees === 'number') {
    if (!Number.isFinite(rupees)) throw new MoneyError('amount must be a finite number');
    normalised = rupees;
  } else if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/[,\s\u20B9]/g, '');
    if (!/^-?\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '-' || cleaned === '.') {
      throw new MoneyError(`amount is not a valid number: ${rupees}`);
    }
    normalised = Number(cleaned);
  } else {
    throw new MoneyError('amount must be a number or a numeric string');
  }
  // Scale first, then round, then clamp the -0 case.
  const scaled = normalised * MINOR_UNITS_PER_MAJOR;
  const paise = Math.sign(scaled) * Math.round(Math.abs(scaled));
  if (!Number.isSafeInteger(paise)) throw new MoneyError('amount is out of the supported range');
  return paise === 0 ? 0 : paise;
}

/** Paise -> a plain rupee number. For display and chart data only, never for ledger math. */
export function fromPaise(paise) {
  assertPaise(paise);
  return paise / MINOR_UNITS_PER_MAJOR;
}

/** Exact-sum of a list of paise amounts. */
export function sumPaise(values) {
  return values.reduce((acc, v) => acc + assertPaise(v), 0);
}

/**
 * Render paise as a localized currency string, e.g. 123456 -> "₹1,234.56".
 * `options.hideDecimals` drops the paise when the value is a whole rupee amount.
 */
export function formatMoney(paise, options = {}) {
  const { currency = DEFAULT_CURRENCY, signDisplay = 'auto', hideDecimals = false } = options;
  const meta = CURRENCIES[currency] || CURRENCIES[DEFAULT_CURRENCY];
  assertPaise(paise);
  const whole = paise % MINOR_UNITS_PER_MAJOR === 0;
  const fractionDigits = hideDecimals && whole ? 0 : 2;
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      signDisplay,
    }).format(paise / meta.minorUnits);
  } catch {
    // Intl should always exist in our targets; this keeps formatting non-fatal.
    return `${meta.symbol}${(paise / meta.minorUnits).toFixed(fractionDigits)}`;
  }
}

/** Absolute-value variant used where the UI shows direction separately ("owes" / "is owed"). */
export function formatMoneyAbs(paise, options = {}) {
  return formatMoney(Math.abs(assertPaise(paise)), options);
}

/** Paise -> a plain editable input string ("1234.56"). */
export function paiseToInputString(paise) {
  assertPaise(paise);
  return (paise / MINOR_UNITS_PER_MAJOR).toFixed(2);
}
