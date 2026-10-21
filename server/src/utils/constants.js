/** Shared enumerations. Kept here so models, validators and the client agree. */

export const TRANSACTION_TYPES = ['income', 'expense'];

/** Expense categories. `income` transactions use INCOME_CATEGORIES instead. */
export const EXPENSE_CATEGORIES = [
  'food',
  'transportation',
  'shopping',
  'rent',
  'bills',
  'entertainment',
  'healthcare',
  'education',
  'travel',
  'groceries',
  'other',
];

export const INCOME_CATEGORIES = ['salary', 'business', 'freelance', 'investment', 'gift', 'refund', 'other'];

export const ALL_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'netbanking', 'wallet', 'other'];

export const GROUP_TYPES = ['trip', 'roommates', 'friends', 'event', 'household', 'other'];

export const GROUP_ROLES = ['owner', 'admin', 'member'];

export const MEMBERSHIP_STATUS = ['active', 'removed'];

export const INVITATION_STATUS = ['pending', 'accepted', 'declined', 'revoked'];

export const SETTLEMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'other'];

export const SPLIT_TYPES = ['EQUAL', 'EXACT', 'PERCENT'];

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;
