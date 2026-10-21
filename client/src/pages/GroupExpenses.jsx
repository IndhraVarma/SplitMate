import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../layouts/GroupLayout.jsx';
import useAsync from '../hooks/useAsync.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import * as groupService from '../services/group.service.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Pagination,
  Select,
  TextInput,
  Avatar,
  Badge,
} from '../components/ui/index.js';
import NavIcon from '../components/NavIcon.jsx';
import { formatMoney } from '../utils/money.js';
import { categoryColor, titleCase, formatRelativeDay } from '../utils/format.js';
import { EXPENSE_CATEGORIES } from '../utils/constants.js';

export default function GroupExpenses() {
  const { groupId, activeMembers, currentUserId } = useGroup();
  const [filters, setFilters] = useState({ search: '', category: '', paidBy: '', page: 1 });
  const debouncedSearch = useDebouncedValue(filters.search, 350);

  const query = useMemo(() => {
    const q = { page: filters.page, limit: 20 };
    if (debouncedSearch) q.search = debouncedSearch;
    if (filters.category) q.category = filters.category;
    if (filters.paidBy) q.paidBy = filters.paidBy;
    return q;
  }, [debouncedSearch, filters.category, filters.paidBy, filters.page]);

  const expenses = useAsync(() => groupService.listExpenses(groupId, query), [groupId, query]);

  const items = expenses.data?.data?.expenses || [];
  const hasFilters = Boolean(filters.search || filters.category || filters.paidBy);

  return (
    <>
      <Card className="mb-4">
        <div className="space-y-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
              <NavIcon name="search" className="h-4 w-4" />
            </span>
            <TextInput
              type="search"
              className="pl-10"
              placeholder="Search expenses"
              aria-label="Search expenses"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs" htmlFor="expense-category">
                Category
              </label>
              <Select
                id="expense-category"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}
              >
                <option value="">All</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="expense-payer">
                Paid by
              </label>
              <Select
                id="expense-payer"
                value={filters.paidBy}
                onChange={(e) => setFilters((f) => ({ ...f, paidBy: e.target.value, page: 1 }))}
              >
                <option value="">Anyone</option>
                {activeMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userId === currentUserId ? 'You' : m.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ search: '', category: '', paidBy: '', page: 1 })}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      <Card>
        {expenses.loading && !expenses.data ? (
          <ListSkeleton rows={5} />
        ) : expenses.error ? (
          <ErrorState error={expenses.error} onRetry={expenses.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={hasFilters ? 'search' : 'wallet'}
            title={hasFilters ? 'No expenses match those filters' : 'No expenses yet'}
            description={
              hasFilters
                ? 'Try clearing the filters to see everything in this group.'
                : 'Add the first shared expense and balances will start building.'
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilters({ search: '', category: '', paidBy: '', page: 1 })}
                >
                  Clear filters
                </Button>
              ) : (
                <Button to={`/app/groups/${groupId}/expenses/new`} size="sm">
                  Add an expense
                </Button>
              )
            }
          />
        ) : (
          <>
            <ul className={`-mx-1 divide-y divide-surface-border/60 ${expenses.loading ? 'opacity-60' : ''}`}>
              {items.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  groupId={groupId}
                  currentUserId={currentUserId}
                />
              ))}
            </ul>
            <Pagination
              meta={expenses.data.meta}
              onChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </Card>
    </>
  );
}

/**
 * One expense line. The "your share" figure beneath it is the number most
 * people actually care about, so it is shown without opening the expense.
 */
function ExpenseRow({ expense, groupId, currentUserId }) {
  const color = categoryColor(expense.category);
  const myShare = expense.shares.find((s) => s.userId === currentUserId);
  const iPaid = expense.paidBy.userId === currentUserId;

  return (
    <li>
      <Link
        to={`/app/groups/${groupId}/expenses/${expense.id}/edit`}
        className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-surface-border hover:bg-surface-overlay"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
          style={{ backgroundColor: `${color}1f`, color }}
          aria-hidden="true"
        >
          {titleCase(expense.category).slice(0, 2)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{expense.description}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
            <Avatar
              name={expense.paidBy.name}
              color={expense.paidBy.avatarColor}
              size="xs"
              className="h-4 w-4 text-[8px]"
            />
            <span className="truncate">
              {iPaid ? 'You' : expense.paidBy.name} paid &middot; {formatRelativeDay(expense.date)}
            </span>
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="tabular block text-sm font-semibold text-ink">
            {formatMoney(expense.amountPaise)}
          </span>
          {myShare && (
            <span className="tabular mt-0.5 block text-xs text-ink-faint">
              your share {formatMoney(myShare.amountPaise)}
            </span>
          )}
          {!myShare && (
            <Badge tone="neutral" className="mt-1">
              not involved
            </Badge>
          )}
        </span>
      </Link>
    </li>
  );
}
