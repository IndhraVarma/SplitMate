import { Router } from 'express';
import * as controller from '../controllers/group.controller.js';
import * as expenseController from '../controllers/expense.controller.js';
import * as settlementController from '../controllers/settlement.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireGroupMember, requireGroupAdmin, requireGroupOwner } from '../middleware/groupAccess.js';
import {
  createGroupSchema,
  updateGroupSchema,
  addMemberSchema,
  inviteSchema,
  acceptInviteSchema,
  memberParams,
} from '../validators/group.validators.js';
import { createExpenseSchema, updateExpenseSchema, listExpensesQuery } from '../validators/expense.validators.js';
import { createSettlementSchema, listSettlementsQuery } from '../validators/settlement.validators.js';
import { groupIdParam, groupAndIdParams } from '../validators/common.js';

const router = Router();
router.use(authenticate);

/* ---- Collection ---- */
router.get('/', controller.list);
router.post('/', validate({ body: createGroupSchema }), controller.create);

/* ---- Invitations addressed to me ---- */
router.get('/invitations/mine', controller.myInvitations);
router.post('/invitations/accept', validate({ body: acceptInviteSchema }), controller.acceptInvitation);

/* ---- One group. requireGroupMember is the single authorization gate. ---- */
const memberOnly = [validate({ params: groupIdParam }), requireGroupMember()];
const adminOnly = [validate({ params: groupIdParam }), requireGroupAdmin];

router.get('/:groupId', memberOnly, controller.getOne);
router.patch('/:groupId', adminOnly, validate({ body: updateGroupSchema }), controller.update);
router.delete('/:groupId', validate({ params: groupIdParam }), requireGroupOwner, controller.remove);

/* ---- Members ---- */
router.get('/:groupId/members', memberOnly, controller.members);
router.post('/:groupId/members', adminOnly, validate({ body: addMemberSchema }), controller.addMember);
router.delete('/:groupId/members/:userId', validate({ params: memberParams }), requireGroupAdmin, controller.removeMember);

/* ---- Invitations for this group ---- */
router.get('/:groupId/invitations', adminOnly, controller.listInvitations);
router.post('/:groupId/invitations', adminOnly, validate({ body: inviteSchema }), controller.invite);
router.delete('/:groupId/invitations/:id', validate({ params: groupAndIdParams }), requireGroupAdmin, controller.revokeInvitation);

/* ---- Expenses ---- */
router.get('/:groupId/expenses', memberOnly, validate({ query: listExpensesQuery }), expenseController.list);
router.post('/:groupId/expenses', memberOnly, validate({ body: createExpenseSchema }), expenseController.create);
router.get('/:groupId/expenses/:id', validate({ params: groupAndIdParams }), requireGroupMember(), expenseController.getOne);
router.put('/:groupId/expenses/:id', validate({ params: groupAndIdParams }), requireGroupMember(), validate({ body: updateExpenseSchema }), expenseController.update);
router.delete('/:groupId/expenses/:id', validate({ params: groupAndIdParams }), requireGroupMember(), expenseController.remove);

/* ---- Balances and simplified debts ---- */
router.get('/:groupId/balances', memberOnly, controller.balances);

/* ---- Settlements ---- */
router.get('/:groupId/settlements', memberOnly, validate({ query: listSettlementsQuery }), settlementController.list);
router.post('/:groupId/settlements', memberOnly, validate({ body: createSettlementSchema }), settlementController.create);
router.delete('/:groupId/settlements/:id', validate({ params: groupAndIdParams }), requireGroupMember(), settlementController.remove);

export default router;
