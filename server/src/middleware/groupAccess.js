import { asyncHandler } from '../utils/asyncHandler.js';
import { requireMembership } from '../services/group.service.js';

/**
 * Attaches req.group and req.membership, or rejects the request.
 *
 * Every /api/groups/:groupId/... route mounts this, so there is exactly one
 * place where group access is decided - no controller can forget it.
 */
export function requireGroupMember(options = {}) {
  return asyncHandler(async (req, _res, next) => {
    const { group, membership } = await requireMembership(req.params.groupId, req.userId, options);
    req.group = group;
    req.membership = membership;
    next();
  });
}

/** Owner- or admin-only operations (renaming, deleting, managing members). */
export const requireGroupAdmin = requireGroupMember({ roles: ['owner', 'admin'] });

/** Owner-only operations (deleting the group). */
export const requireGroupOwner = requireGroupMember({ roles: ['owner'] });

export default requireGroupMember;
