/** Date, label and text formatting shared across screens. */

const DATE_OPTS = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

export function formatDate(value, options = DATE_OPTS) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', options).format(d);
}

export function formatShortDate(value) {
  return formatDate(value, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "Today" / "Yesterday" / a date, for transaction list headers. */
export function formatRelativeDay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const dayDiff = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) /
      86400000
  );
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} days ago`;
  return formatDate(value);
}

/** An <input type="date"> value from a Date or ISO string. */
export function toDateInputValue(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

/** "food" -> "Food", "bank_transfer" -> "Bank transfer". */
export function titleCase(value) {
  if (!value) return '';
  const spaced = String(value).replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month) {
  return MONTH_NAMES[month - 1] || '';
}

/** Deterministic colour for a category chip, from a fixed palette. */
const CATEGORY_COLORS = {
  food: '#6B8A47', groceries: '#1F7A6B', transportation: '#2F6FB5', shopping: '#7A4FA8',
  rent: '#B5447A', bills: '#B5811B', entertainment: '#C2601F', healthcare: '#C0392B',
  education: '#4E7A1F', travel: '#17736C', salary: '#2E7D32', business: '#1C6FA8',
  freelance: '#6A4EA8', investment: '#A8871B', gift: '#B5447A', refund: '#2E7D32',
  other: '#6E7A63',
};

export function categoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
}

export const CATEGORY_ICONS = {
  food: 'Food', groceries: 'Groceries', transportation: 'Transport', shopping: 'Shopping',
  rent: 'Rent', bills: 'Bills', entertainment: 'Fun', healthcare: 'Health',
  education: 'Education', travel: 'Travel', other: 'Other',
};
