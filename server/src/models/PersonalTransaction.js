import mongoose from 'mongoose';
import { TRANSACTION_TYPES, ALL_CATEGORIES, PAYMENT_METHODS } from '../utils/constants.js';

/**
 * A single personal income or expense entry. Group expenses live in
 * GroupExpense and never appear here, so the personal ledger is not polluted by
 * money that was only fronted on behalf of other people.
 */
const personalTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    /** Integer paise. Always positive; direction is carried by `type`. */
    amountPaise: {
      type: Number,
      required: true,
      min: [1, 'Amount must be greater than zero.'],
      validate: {
        validator: Number.isSafeInteger,
        message: 'Amount must be an integer number of paise.',
      },
    },
    category: { type: String, enum: ALL_CATEGORIES, required: true, index: true },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'other' },
    /** UTC midnight of the day the money moved. */
    date: { type: Date, required: true, index: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// The list screen is always "this user, newest first", optionally narrowed by
// type or category, so these compound indexes cover every common query.
personalTransactionSchema.index({ user: 1, date: -1 });
personalTransactionSchema.index({ user: 1, type: 1, date: -1 });
personalTransactionSchema.index({ user: 1, category: 1, date: -1 });

export const PersonalTransaction =
  mongoose.models.PersonalTransaction ||
  mongoose.model('PersonalTransaction', personalTransactionSchema);
export default PersonalTransaction;
