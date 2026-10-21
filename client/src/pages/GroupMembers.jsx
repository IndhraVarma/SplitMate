import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroup } from '../layouts/GroupLayout.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as groupService from '../services/group.service.js';
import * as authService from '../services/auth.service.js';
import useAsync from '../hooks/useAsync.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import {
  Button,
  Card,
  CardHeader,
  Avatar,
  Badge,
  Field,
  TextInput,
  Modal,
  ConfirmDialog,
  Spinner,
} from '../components/ui/index.js';
import NavIcon from '../components/NavIcon.jsx';
import { titleCase } from '../utils/format.js';

export default function GroupMembers() {
  const { groupId, group, members, isAdmin, myRole, currentUserId, invitations, reloadGroup } =
    useGroup();
  const toast = useToast();
  const navigate = useNavigate();

  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [copied, setCopied] = useState(null);

  const activeMembers = members.filter((m) => m.status === 'active');
  const formerMembers = members.filter((m) => m.status !== 'active');

  const removeMember = async () => {
    try {
      await groupService.removeMember(groupId, removing.userId);
      toast.success(`${removing.name} was removed from the group.`);
      setRemoving(null);
      reloadGroup();
    } catch (error) {
      // The API refuses to remove someone who still owes or is owed money.
      toast.error(error.message);
      setRemoving(null);
    }
  };

  const deleteGroup = async () => {
    try {
      await groupService.deleteGroup(groupId);
      toast.success('Group deleted.');
      navigate('/app/groups');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const copyInvite = async (invitation) => {
    const link = `${window.location.origin}/app/groups/join?token=${invitation.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(invitation.id);
      setTimeout(() => setCopied(null), 2000);
      toast.success('Invite link copied.');
    } catch {
      toast.error('Could not copy. The invite code is shown on screen.');
    }
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader
          title="Members"
          subtitle={`${activeMembers.length} in this group`}
          action={
            isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
                  <NavIcon name="invite" className="h-4 w-4" />
                  Invite
                </Button>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <NavIcon name="plus" className="h-4 w-4" />
                  Add
                </Button>
              </div>
            )
          }
        />

        <ul className="space-y-1">
          {activeMembers.map((member) => (
            <li
              key={member.userId}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-overlay"
            >
              <Avatar name={member.name} color={member.avatarColor} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {member.name}
                  {member.userId === currentUserId && (
                    <span className="ml-1.5 text-xs font-normal text-ink-faint">(you)</span>
                  )}
                </span>
                <span className="block truncate text-xs text-ink-faint">{member.email}</span>
              </span>
              {member.role !== 'member' && <Badge tone="accent">{titleCase(member.role)}</Badge>}
              {isAdmin && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoving(member)}
                  aria-label={`Remove ${member.name}`}
                >
                  <NavIcon name="trash" className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>

        {formerMembers.length > 0 && (
          <div className="mt-5 border-t border-surface-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Former members
            </h3>
            <p className="mt-1 text-xs text-ink-faint">
              They no longer have access, but their past expenses still count.
            </p>
            <ul className="mt-2 space-y-1">
              {formerMembers.map((member) => (
                <li key={member.userId} className="flex items-center gap-3 px-2 py-2 opacity-60">
                  <Avatar name={member.name} color={member.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                    {member.name}
                  </span>
                  <Badge tone="neutral">Removed</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* --- Pending invitations ------------------------------------------ */}
      {isAdmin && (
        <Card className="mb-4">
          <CardHeader
            title="Pending invitations"
            subtitle="SplitMate does not send email - share the link yourself."
          />
          {!invitations || invitations.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">No pending invitations.</p>
          ) : (
            <ul className="space-y-2">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="rounded-xl border border-surface-border bg-surface-overlay/40 p-3.5"
                >
                  <p className="text-sm font-medium text-ink">{invitation.email}</p>
                  <code className="mt-1.5 block truncate rounded-lg bg-surface-base px-2.5 py-1.5 text-xs text-ink-muted">
                    {invitation.token}
                  </code>
                  <div className="mt-2 flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => copyInvite(invitation)}>
                      <NavIcon name="copy" className="h-4 w-4" />
                      {copied === invitation.id ? 'Copied' : 'Copy link'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await groupService.revokeInvitation(groupId, invitation.id);
                        toast.success('Invitation revoked.');
                        reloadGroup();
                      }}
                    >
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* --- Danger zone --------------------------------------------------- */}
      {myRole === 'owner' && (
        <Card className="border-negative/25">
          <CardHeader title="Delete this group" subtitle="Everything in it goes with it." />
          <p className="mb-4 text-sm text-ink-muted">
            All expenses, balances and settlement history for {group.name} will be permanently
            removed for every member. This cannot be undone.
          </p>
          <Button variant="danger" onClick={() => setDeletingGroup(true)}>
            <NavIcon name="trash" className="h-4 w-4" />
            Delete group
          </Button>
        </Card>
      )}

      <AddMemberDialog
        open={addOpen}
        groupId={groupId}
        existingIds={members.map((m) => m.userId)}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          reloadGroup();
          toast.success('Member added.');
        }}
      />

      <InviteDialog
        open={inviteOpen}
        groupId={groupId}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          setInviteOpen(false);
          reloadGroup();
        }}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={removeMember}
        title={`Remove ${removing?.name || 'this member'}?`}
        description="They can only be removed once their balance in this group is zero."
        confirmLabel="Remove"
      />

      <ConfirmDialog
        open={deletingGroup}
        onClose={() => setDeletingGroup(false)}
        onConfirm={deleteGroup}
        title={`Delete ${group.name}?`}
        description="Every expense, balance and settlement in this group is permanently removed."
        confirmLabel="Delete group"
      />
    </>
  );
}

/** Adds an existing SplitMate account to the group. */
function AddMemberDialog({ open, groupId, existingIds, onClose, onAdded }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(null);
  const debounced = useDebouncedValue(query, 350);

  const results = useAsync(
    () =>
      debounced.trim().length >= 3
        ? authService.searchUsers(debounced.trim()).then((r) => r.data.users)
        : Promise.resolve([]),
    [debounced]
  );

  const add = async (user) => {
    setAdding(user.id);
    setError(null);
    try {
      await groupService.addMember(groupId, { userId: user.id });
      setQuery('');
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a member"
      description="Search for someone who already has a SplitMate account."
      size="sm"
    >
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative"
        >
          {error}
        </p>
      )}

      <Field label="Search by name or email" htmlFor="add-member-search">
        <TextInput
          id="add-member-search"
          type="search"
          placeholder="Start typing"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          data-autofocus
        />
      </Field>

      <div className="mt-3 min-h-[80px]">
        {debounced.trim().length < 3 ? (
          <p className="py-4 text-center text-sm text-ink-faint">Type at least 3 characters.</p>
        ) : results.loading ? (
          <p className="flex items-center justify-center gap-2 py-4 text-sm text-ink-muted">
            <Spinner size="sm" /> Searching...
          </p>
        ) : results.data && results.data.length > 0 ? (
          <ul className="space-y-1">
            {results.data.map((user) => {
              const already = existingIds.includes(user.id);
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => add(user)}
                    disabled={already || adding === user.id}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-overlay disabled:opacity-50"
                  >
                    <Avatar name={user.name} color={user.avatarColor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{user.name}</span>
                      <span className="block truncate text-xs text-ink-faint">{user.email}</span>
                    </span>
                    {already ? (
                      <Badge tone="neutral">In group</Badge>
                    ) : adding === user.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <Badge tone="accent">Add</Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-ink-muted">
            Nobody matches that. Use Invite to send them a join code instead.
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Creates an invitation token for an email address. */
function InviteDialog({ open, groupId, onClose, onInvited }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await groupService.inviteToGroup(groupId, email.trim());
      setCreated(data.invitation);
      setEmail('');
      onInvited();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const link = created
    ? `${window.location.origin}/app/groups/join?token=${created.token}`
    : '';

  return (
    <Modal
      open={open}
      onClose={() => {
        setCreated(null);
        onClose();
      }}
      title="Invite someone"
      description="SplitMate has no mail provider, so you share the link yourself."
      size="sm"
    >
      {created ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-3 text-sm text-positive">
            Invitation created for {created.email}.
            {created.isRegisteredUser
              ? ' They already have an account, so the link will work straight away.'
              : ' They will need to create an account with that email first.'}
          </p>
          <Field label="Invite link" htmlFor="invite-link">
            <TextInput id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} />
          </Field>
          <Button
            fullWidth
            onClick={() => {
              navigator.clipboard?.writeText(link);
            }}
          >
            <NavIcon name="copy" className="h-4 w-4" />
            Copy link
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setCreated(null)}>
            Invite someone else
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative"
            >
              {error}
            </p>
          )}
          <Field label="Email address" required>
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                type="email"
                placeholder="them@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                describedBy={describedBy}
                data-autofocus
              />
            )}
          </Field>
          <Button type="submit" fullWidth loading={saving}>
            Create invitation
          </Button>
        </form>
      )}
    </Modal>
  );
}
