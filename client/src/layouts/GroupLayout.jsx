import { createContext, useContext } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import PageHeader from './PageHeader.jsx';
import useAsync from '../hooks/useAsync.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { useAuth } from '../context/AuthContext.jsx';
import * as groupService from '../services/group.service.js';
import { Button, ErrorState, Spinner, Badge, AvatarStack } from '../components/ui/index.js';
import NavIcon from '../components/NavIcon.jsx';
import { GROUP_TYPE_LABELS } from '../utils/constants.js';

const GroupContext = createContext(null);

/**
 * Loads one group once and shares it with every tab beneath it, so switching
 * between Expenses / Balances / Settlements does not refetch the header.
 *
 * `reloadAll` is handed to children because adding an expense or a settlement
 * changes the balances the sibling tabs show.
 */
export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup must be used inside a GroupLayout.');
  return ctx;
}

const TABS = [
  { to: '', label: 'Expenses', end: true },
  { to: 'balances', label: 'Balances' },
  { to: 'settlements', label: 'Settlements' },
  { to: 'members', label: 'Members' },
];

export default function GroupLayout() {
  const { groupId } = useParams();
  const { user } = useAuth();

  const group = useAsync(() => groupService.getGroup(groupId).then((r) => r.data), [groupId]);
  useDocumentTitle(group.data?.group?.name || 'Group');

  if (group.loading && !group.data) {
    return (
      <div className="flex justify-center py-20 text-accent">
        <Spinner size="lg" label="Loading group" />
      </div>
    );
  }

  if (group.error) {
    return (
      <>
        <PageHeader title="Group" backTo="/app/groups" />
        <ErrorState
          error={group.error}
          title={
            group.error.status === 404
              ? 'This group does not exist, or you are not a member'
              : 'Could not load this group'
          }
          onRetry={group.error.status === 404 ? undefined : group.reload}
        />
        <div className="mt-4 flex justify-center">
          <Button to="/app/groups" variant="secondary">
            Back to your groups
          </Button>
        </div>
      </>
    );
  }

  const { group: info, members, myRole, invitations } = group.data;
  const activeMembers = members.filter((m) => m.status === 'active');
  const isAdmin = ['owner', 'admin'].includes(myRole);

  const value = {
    groupId,
    group: info,
    members,
    activeMembers,
    myRole,
    isAdmin,
    invitations,
    currentUserId: user?.id,
    reloadGroup: group.reload,
  };

  return (
    <GroupContext.Provider value={value}>
      <PageHeader
        title={info.name}
        subtitle={info.description || `${GROUP_TYPE_LABELS[info.type] || 'Group'}`}
        backTo="/app/groups"
        action={
          <Button to={`/app/groups/${groupId}/expenses/new`} size="sm">
            <NavIcon name="plus" className="h-4 w-4" />
            Add expense
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <AvatarStack people={activeMembers} />
        <span className="text-sm text-ink-muted">
          {activeMembers.length} member{activeMembers.length === 1 ? '' : 's'}
        </span>
        {myRole !== 'member' && <Badge tone="accent">You are the {myRole}</Badge>}
      </div>

      {/* Tab bar. Scrolls horizontally only if a narrow phone truly needs it. */}
      <nav
        className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-surface-border bg-surface-overlay p-1"
        aria-label="Group sections"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to ? `/app/groups/${groupId}/${tab.to}` : `/app/groups/${groupId}`}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-ink-onAccent'
                  : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={value} />
    </GroupContext.Provider>
  );
}
