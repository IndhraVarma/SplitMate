import mongoose from 'mongoose';
import { SETTLEMENT_METHODS } from '../utils/constants.js';

/**
 * A record that one member reimbursed another.
 *
 * A settlement is an ACCOUNTING ENTRY, not a payment: SplitMate never moves
 * real money. It reduces what `fromUser` owes `toUser` and is excluded from
 * every "how much did this group spend" total.
 *
 * Partial settlements are the normal case - nothing requires the amount to
 * equal the outstanding debt.
 */
const settlementSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountPaise: {
      type: Number,
      required: true,
      min: [1, 'A settlement must be greater than zero.'],
      validate: { validator: Number.isSafeInteger, message: 'Amount must be whole paise.' },
    },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    method: { type: String, enum: SETTLEMENT_METHODS, default: 'other' },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    settledAt: { type: Date, required: true, default: Date.now, index: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /**
     * Idempotency key supplied by the client. Two submissions of the same form
     * (a double tap, or a retry after a flaky connection) carry the same key,
     * and the unique index below turns the second one into a no-op that returns
     * the original settlement instead of double-counting the repayment.
     */
    clientRequestId: { type: String, default: null },
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

settlementSchema.index(
  { group: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);
settlementSchema.index({ group: 1, settledAt: -1 });

export const Settlement =
  mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema);
export default Settlement;
