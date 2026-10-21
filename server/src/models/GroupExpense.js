import mongoose from 'mongoose';
import { EXPENSE_CATEGORIES, SPLIT_TYPES } from '../utils/constants.js';

/**
 * A shared expense.
 *
 * The authoritative per-member allocation lives in the ExpenseShare collection,
 * not in an embedded array, so balances can be aggregated per user across a
 * whole group without loading every expense document. `amountPaise` here is the
 * stated total; balance maths always re-derives from the shares, so a stale
 * total can never unbalance a group (see shared/balance.js).
 */
const groupExpenseSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    amountPaise: {
      type: Number,
      required: true,
      min: [1, 'Amount must be greater than zero.'],
      validate: { validator: Number.isSafeInteger, message: 'Amount must be whole paise.' },
    },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: 'other' },
    date: { type: Date, required: true, index: true },
    /** The member who actually paid the merchant. */
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    splitType: { type: String, enum: SPLIT_TYPES, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    // Optimistic concurrency: a concurrent edit of the same expense bumps the
    // version key, and the losing writer gets a VersionError instead of
    // silently overwriting the other edit.
    optimisticConcurrency: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

groupExpenseSchema.index({ group: 1, date: -1 });

export const GroupExpense =
  mongoose.models.GroupExpense || mongoose.model('GroupExpense', groupExpenseSchema);
export default GroupExpense;
