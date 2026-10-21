import mongoose from 'mongoose';
import { GROUP_ROLES, MEMBERSHIP_STATUS } from '../utils/constants.js';

/**
 * Membership is its own collection rather than an array on Group so that
 * "which groups am I in?" is a single indexed query, and so a member can be
 * deactivated without destroying the expense history that references them.
 */
const groupMembershipSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: GROUP_ROLES, default: 'member' },
    status: { type: String, enum: MEMBERSHIP_STATUS, default: 'active', index: true },
    joinedAt: { type: Date, default: Date.now },
    removedAt: { type: Date, default: null },
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

// One membership row per (group, user); re-adding a removed member flips the
// status back to active instead of inserting a duplicate.
groupMembershipSchema.index({ group: 1, user: 1 }, { unique: true });
groupMembershipSchema.index({ user: 1, status: 1 });

export const GroupMembership =
  mongoose.models.GroupMembership || mongoose.model('GroupMembership', groupMembershipSchema);
export default GroupMembership;
