import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import * as groupService from '../services/group.service.js';
import * as balanceService from '../services/balance.service.js';

export const list = asyncHandler(async (req, res) =>
  sendSuccess(res, await groupService.listGroupsForUser(req.userId))
);

export const create = asyncHandler(async (req, res) =>
  sendCreated(res, await groupService.createGroup(req.userId, req.body), {
    message: 'Group created.',
  })
);

/** req.group / req.membership are attached by the requireGroupMember middleware. */
export const getOne = asyncHandler(async (req, res) => {
  const [members, invitations] = await Promise.all([
    groupService.listMembers(req.params.groupId),
    ['owner', 'admin'].includes(req.membership.role)
      ? groupService.listInvitations(req.params.groupId)
      : Promise.resolve([]),
  ]);
  return sendSuccess(res, {
    group: req.group.toJSON(),
    members,
    invitations,
    myRole: req.membership.role,
  });
});

export const update = asyncHandler(async (req, res) =>
  sendSuccess(res, { group: await groupService.updateGroup(req.params.groupId, req.body) }, {
    message: 'Group updated.',
  })
);

export const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, await groupService.deleteGroup(req.params.groupId), {
    message: 'Group deleted.',
  })
);

export const members = asyncHandler(async (req, res) =>
  sendSuccess(res, { members: await groupService.listMembers(req.params.groupId) })
);

export const addMember = asyncHandler(async (req, res) =>
  sendCreated(res, { member: await groupService.addMember(req.params.groupId, req.body) }, {
    message: 'Member added.',
  })
);

export const removeMember = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await groupService.removeMember(req.params.groupId, req.params.userId, req.userId),
    { message: 'Member removed.' }
  )
);

export const invite = asyncHandler(async (req, res) =>
  sendCreated(
    res,
    { invitation: await groupService.inviteByEmail(req.params.groupId, req.userId, req.body.email) },
    {
      message:
        'Invitation created. SplitMate does not send email - share the invite code with them yourself.',
    }
  )
);

export const listInvitations = asyncHandler(async (req, res) =>
  sendSuccess(res, { invitations: await groupService.listInvitations(req.params.groupId) })
);

export const revokeInvitation = asyncHandler(async (req, res) =>
  sendSuccess(res, await groupService.revokeInvitation(req.params.groupId, req.params.id), {
    message: 'Invitation revoked.',
  })
);

export const acceptInvitation = asyncHandler(async (req, res) =>
  sendSuccess(res, await groupService.acceptInvitation(req.body.token, req.user), {
    message: 'You have joined the group.',
  })
);

export const myInvitations = asyncHandler(async (req, res) =>
  sendSuccess(res, { invitations: await groupService.listMyInvitations(req.user) })
);

export const balances = asyncHandler(async (req, res) =>
  sendSuccess(res, await balanceService.getGroupBalances(req.params.groupId))
);
