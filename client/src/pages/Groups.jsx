import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { useToast } from '../context/ToastContext.jsx';
import * as groupService from '../services/group.service.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  TextInput,
  AvatarStack,
} from '../components/ui/index.js';
import NavIcon from '../components/NavIcon.jsx';
import { formatMoney } from '../utils/money.js';
import { GROUP_TYPE_LABELS } from '../utils/constants.js';

/** A distinct tile colour per group type, so the list reads at a glance. */
const TYPE_TINT = {
  trip: '#A7C06E',
  roommates: '#87A354',
  friends: '#C6D894',
  event: '#6B8A47',
  household: '#DCE9B4',
  other: '#B9CE8C',
};

export default function Groups() {
  useDocumentTitle('Groups');
  const toast = useToast();
  const [query, setQuery] = useState('');

  const groups = useAsync(() => groupService.listGroups().then((r) => r.data), []);
  const invitations = useAsync(
    () => groupService.listMyInvitations().then((r) => r.data.invitations),
    []
  );
  const [accepting, setAccepting] = useState(null);

  const accept = async (invitation) => {
    setAccepting(invitation.id);
    try {
      await groupService.acceptInvitation(invitation.token);
      toast.success(`You have joined ${invitation.group.name}.`);
      groups.reload();
      invitations.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAccepting(null);
    }
  };

  const visible = useMemo(() => {
    const all = groups.data?.groups || [];
    const q = query.trim().toLowerCase();
    return q ? all.filter((g) => g.name.toLowerCase().includes(q)) : all;
  }, [groups.data, query]);

  const totals = groups.data?.totals;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="hidden text-2xl font-extrabold tracking-tight text-ink lg:block">Groups</h1>
        <Button to="/app/groups/new" size="sm" className="ml-auto !rounded-full">
          <NavIcon name="plus" className="h-4 w-4" />
          New group
        </Button>
      </div>

      <div className="relative mb-5">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
          <NavIcon name="search" className="h-4 w-4" />
        </span>
        <TextInput
          type="search"
          className="!rounded-full border-surface-border bg-surface-overlay pl-11"
          placeholder="Search groups"
          aria-label="Search groups"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Pending invitations addressed to this account. */}
      {invitations.data && invitations.data.length > 0 && (
        <Card className="mb-5 border-accent/40 bg-accent-soft">
          <h2 className="text-sm font-bold text-brand-700">
            You have {invitations.data.length} invitation
            {invitations.data.length === 1 ? '' : 's'}
          </h2>
          <ul className="mt-3 space-y-2">
            {invitations.data.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{invitation.group.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {invitation.group.description || 'You have been invited to join this group.'}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="!rounded-full"
                  loading={accepting === invitation.id}
                  onClick={() => accept(invitation)}
                >
                  Join
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {totals && (totals.owedToUserPaise > 0 || totals.userOwesPaise > 0) && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-positive/25 bg-positive/5 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
              You are owed
            </p>
            <p className="tabular mt-1.5 text-2xl font-extrabold text-positive">
              {formatMoney(totals.owedToUserPaise)}
            </p>
          </div>
          <div className="rounded-2xl border border-negative/25 bg-negative/5 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">You owe</p>
            <p className="tabular mt-1.5 text-2xl font-extrabold text-negative">
              {formatMoney(totals.userOwesPaise)}
            </p>
          </div>
        </div>
      )}

      {groups.loading ? (
        <ListSkeleton rows={4} />
      ) : groups.error ? (
        <ErrorState error={groups.error} onRetry={groups.reload} />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon="group"
            title={query ? 'No groups match that' : 'No groups yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Create a group for a trip, a flat, or anything you split with other people.'
            }
            action={
              !query && (
                <Button to="/app/groups/new" size="sm" className="!rounded-full">
                  Create your first group
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
          {visible.map((group, index) => (
            <li key={group.id} className={index < visible.length - 1 ? 'row-divider' : ''}>
              <Link
                to={`/app/groups/${group.id}`}
                className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-overlay"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-brand-800"
                  style={{ backgroundColor: TYPE_TINT[group.type] || TYPE_TINT.other }}
                  aria-hidden="true"
                >
                  {group.name.slice(0, 2).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold uppercase tracking-wide text-ink">
                    {group.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    {subtitleFor(group)}
                  </span>
                </span>

                {group.members && group.members.length > 0 && (
                  <AvatarStack people={group.members} max={2} size="xs" />
                )}

                <span className="shrink-0 text-ink-faint" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The line under a group name. It leads with whatever the user most needs to
 * know: their own outstanding balance, falling back to group size and activity.
 */
function subtitleFor(group) {
  if (group.myNetBalancePaise > 0) {
    return `You are owed ${formatMoney(group.myNetBalancePaise)}`;
  }
  if (group.myNetBalancePaise < 0) {
    return `You owe ${formatMoney(-group.myNetBalancePaise)}`;
  }
  if (group.expenseCount === 0) {
    return `${GROUP_TYPE_LABELS[group.type] || 'Group'} · no expenses yet`;
  }
  return `Settled up · ${group.expenseCount} expense${group.expenseCount === 1 ? '' : 's'}`;
}
