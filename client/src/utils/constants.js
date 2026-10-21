/** Mirrors the server enumerations so forms and the API always agree. */

export const EXPENSE_CATEGORIES = [
  'food', 'groceries', 'transportation', 'shopping', 'rent', 'bills',
  'entertainment', 'healthcare', 'education', 'travel', 'other',
];

export const INCOME_CATEGORIES = [
  'salary', 'business', 'freelance', 'investment', 'gift', 'refund', 'other',
];

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'netbanking', 'wallet', 'other'];

export const GROUP_TYPES = ['trip', 'roommates', 'friends', 'event', 'household', 'other'];

export const SETTLEMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'other'];

export const SPLIT_TYPES = [
  { value: 'EQUAL', label: 'Equally', hint: 'Everyone pays the same share.' },
  { value: 'EXACT', label: 'Exact amounts', hint: 'Type what each person owes.' },
  { value: 'PERCENT', label: 'Percentages', hint: 'Split by percentage of the total.' },
];

export const GROUP_TYPE_LABELS = {
  trip: 'Trip', roommates: 'Roommates', friends: 'Friends',
  event: 'Event', household: 'Household', other: 'Group',
};
