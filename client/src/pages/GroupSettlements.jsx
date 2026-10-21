import { useMemo, useState } from 'react';
import { useGroup } from '../layouts/GroupLayout.jsx';
import useAsync from '../hooks/useAsync.js';
import { useToast } from '../context/ToastContext.jsx';
import * as groupService from '../services/group.service.js';
import {
  Button,
  Card,
  CardHeader,
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Pagination,
  Select,
  ConfirmDialog,
} from '../components/ui/index.js';
import NavIcon from '../components/NavIcon.jsx';
import { formatMoney } from '../utils/money.js';
import { titleCase, formatDate } from '../utils/format.js';

/**
 * Settlement history.
 *
 * Kept on its own tab so it is never confused with the expense list: an expense
 * is money spent, a settlement is money paid back. Neither appears in the
 * other's totals.
 */
export default function GroupSettlements() {
  const { groupId, activeMembers, currentUserId, isAdmin, reloadGroup } = useGroup();
  const toast = useToast();
  const [filters, setFilters] = useState({ userId: '', page: 1 });
  const [deleting, setDeleting] = useState(null);

  const query = useMemo(() => {
    const q = { page: filters.page, limit: 20 };
    if (filters.userId) q.userId = filters.userId;
    return q;
  }, [filters]);

  const settlements = useAsync(
    () => groupService.listSettlements(groupId, query),
    [groupId, query]
  );

  const items = settlements.data?.data?.settlements || [];

  const remove = async () => {
    try {
      await groupService.deleteSettlement(groupId, deleting.id);
      toast.success('Settlement deleted. Balances have been restored.');
      setDeleting(null);
      settlements.reload();
      reloadGroup();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Settlement history"
          subtitle="Every repayment recorded in this group."
          action={
            <Button to={`/app/groups/${groupId}/balances`} variant="secondary" size="sm">
              Settle up
            </Button>
          }
        />

        <div className="mb-4 max-w-xs">
          <label className="label text-xs" htmlFor="settlement-person">
            Filter by person
          </label>
          <Select
            id="settlement-person"
            value={filters.userId}
            onChange={(e) => setFilters({ userId: e.target.value, page: 1 })}
          >
            <option value="">Everyone</option>
            {activeMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userId === currentUserId ? 'You' : m.name}
              </option>
            ))}
          </Select>
        </div>

        {settlements.loading && !settlements.data ? (
          <ListSkeleton rows={4} />
        ) : settlements.error ? (
          <ErrorState error={settlements.error} onRetry={settlements.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="settle"
            title={filters.userId ? 'No settlements for that person' : 'No settlements yet'}
            description="When someone pays another member back, record it here and the balances update."
            action={
              <Button to={`/app/groups/${groupId}/balances`} size="sm">
                Go to balances
              </Button>
            }
          />
        ) : (
          <>
            <ul className="space-y-2">
              {items.map((settlement) => {
                const canDelete = isAdmin || settlement.recordedBy === currentUserId;
                return (
                  <li
                    key={settlement.id}
                    className="rounded-xl border border-surface-border bg-surface-overlay/40 p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={settlement.from.name}
                        color={settlement.from.avatarColor}
                        size="sm"
                      />
                      <span className="text-ink-faint" aria-hidden="true">
                        <NavIcon name="transactions" className="h-4 w-4" />
                      </span>
                      <Avatar name={settlement.to.name} color={settlement.to.avatarColor} size="sm" />

                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate text-ink">
                          <span className="font-medium">
                            {settlement.from.userId === currentUserId ? 'You' : settlement.from.name}
                          </span>
                          <span className="text-ink-muted"> paid </span>
                          <span className="font-medium">
                            {settlement.to.userId === currentUserId ? 'you' : settlement.to.name}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-faint">
                          {formatDate(settlement.settledAt)}
                          {settlement.method !== 'other' && ` · ${titleCase(settlement.method)}`}
                          {settlement.note && ` · ${settlement.note}`}
                        </span>
                      </span>

                      <span className="tabular shrink-0 text-sm font-semibold text-positive">
                        {formatMoney(settlement.amountPaise)}
                      </span>
                    </div>

                    {canDelete && (
                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(settlement)}>
                          <NavIcon name="trash" className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <Pagination
              meta={settlements.data.meta}
              onChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}

        <p className="mt-4 rounded-xl border border-surface-border bg-surface-overlay/40 px-3.5 py-3 text-xs leading-relaxed text-ink-faint">
          A settlement is a record that money changed hands outside SplitMate. It reduces what one
          member owes another and is never counted as group spending.
        </p>
      </Card>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this settlement?"
        description="The debt it cleared will reappear in the balances."
      />
    </>
  );
}
