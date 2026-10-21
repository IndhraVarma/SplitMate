import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { INVITATION_STATUS } from '../utils/constants.js';

/**
 * An invitation to join a group, addressed to an email that may or may not
 * already belong to a registered user.
 *
 * SplitMate does not send email (no mail provider is configured). Instead the
 * API returns a share token; the inviter passes the link on however they like,
 * and the invitee redeems it after signing in. This is stated plainly in the
 * README rather than pretending mail delivery exists.
 */
const invitationSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: INVITATION_STATUS, default: 'pending', index: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
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

invitationSchema.index({ group: 1, email: 1, status: 1 });

invitationSchema.statics.generateToken = function generateToken() {
  return crypto.randomBytes(24).toString('hex');
};

export const Invitation =
  mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);
export default Invitation;
