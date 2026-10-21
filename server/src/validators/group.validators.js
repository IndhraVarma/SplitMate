import { z } from 'zod';
import { objectId } from './common.js';
import { emailSchema } from './auth.validators.js';
import { GROUP_TYPES } from '../utils/constants.js';

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(2, 'Group name must be at least 2 characters.').max(60),
    description: z.string().trim().max(300).optional().default(''),
    type: z.enum(GROUP_TYPES).optional().default('other'),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour.')
      .optional(),
    /** Optional registered users to add straight away. */
    memberIds: z.array(objectId).max(50).optional().default([]),
    /** Optional emails to invite straight away. */
    inviteEmails: z.array(emailSchema).max(50).optional().default([]),
  })
  .strict();

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(300).optional(),
    type: z.enum(GROUP_TYPES).optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update.' });

export const addMemberSchema = z
  .object({
    userId: objectId.optional(),
    email: emailSchema.optional(),
  })
  .strict()
  .refine((d) => Boolean(d.userId || d.email), {
    message: 'Provide either a user id or an email address.',
  });

export const inviteSchema = z.object({ email: emailSchema }).strict();

export const acceptInviteSchema = z.object({ token: z.string().trim().min(10).max(128) }).strict();

export const memberParams = z.object({ groupId: objectId, userId: objectId });
