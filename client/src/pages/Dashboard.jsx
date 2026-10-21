import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useAsync from '../hooks/useAsync.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import * as txService from '../services/transaction.service.js';
import * as groupService from '../services/group.service.js';
import {
  Button,
  Card,
  CardHeader,
  StatTile,
  EmptyState,
  ErrorState,
  CardSkeleton,
  ListSkeleton,
  Tabs,
  TextInput,
  AvatarStack,
} from '../components/ui/index.js';
import TransactionRow from '../components/transactions/TransactionRow.jsx';
import DailyTrendChart from '../components/charts/DailyTrendChart.jsx';
import CategoryChart from '../components/charts/CategoryChart.jsx';
import NavIcon from '../components/NavIcon.jsx';
import { formatMoney } from '../utils/money.js';
import { monthName } from '../utils/format.js';

const PERIODS = [
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

export default function Dashboard() {
  useDocumentTitle('Home');
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');
  const [groupQuery, setGroupQuery] = useState('');

  const now = useMemo(() => new Date(), []);
  const params = useMemo(
    () =>
      period === 'month'
        ? { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
        : { year: now.getUTCFullYear() },
    [period, now]
  );

  const summary = useAsync(() => txService.getSummary(params).then((r) => r.data), [params]);
  const categories = useAsync(
    () => txService.getCategoryBreakdown(params).then((r) => r.data),
    [params]
  );
  const daily = useAsync(() => txService.getDailyTrend(params).then((r) => r.data), [params]);
  const recent = useAsync(
    () => txService.listTransactions({ limit: 5 }).then((r) => r.data.transactions),
    []
  );
  const groups = useAsync(() => groupService.listGroups().then((r) => r.data), []);

  const periodLabel =
    period === 'month'
      ? `${monthName(now.getUTCMonth() + 1)} ${now.getUTCFullYear()}`
      : String(now.getUTCFullYear());

  const visibleGroups = useMemo(() => {
    const all = groups.data?.groups || [];
    const q = groupQuery.trim().toLowerCase();
    return q ? all.filter((g) => g.name.toLowerCase().includes(q)) : all;
  }, [groups.data, groupQuery]);

  return (
    <>
      {/* Greeting - the mobile bar already says "HOME", so this adds the name. */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">Welcome back,</p>
          <p className="text-2xl font-extrabold tracking-tight text-ink">
            {(user?.name || '').split(' ')[0] || 'there'}
          </p>
        </div>
        <Button to="/app/transactions/new" size="sm" className="!rounded-full">
          <NavIcon name="plus" className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* --- Recent groups ------------------------------------------------ */}
      <section className="mb-6">
        <div className="relative mb-4">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
            <NavIcon name="search" className="h-4 w-4" />
          </span>
          <TextInput
            type="search"
            className="!rounded-full border-surface-border bg-surface-overlay pl-11"
            placeholder="Search groups"
            aria-label="Search groups"
            value={groupQuery}
            onChange={(e) => setGroupQuery(e.target.value)}
          />
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">
            Recent groups
          </h2>
          <Link to="/app/groups" className="text-xs font-semibold text-brand-600 hover:underline">
            See all
          </Link>
        </div>

        {groups.loading ? (
          <ListSkeleton rows={2} />
        ) : groups.error ? (
          <ErrorState error={groups.error} onRetry={groups.reload} />
        ) : visibleGroups.length === 0 ? (
          <Card>
            <EmptyState
              icon="group"
              title={groupQuery ? 'No groups match that' : 'No groups yet'}
              description={
                groupQuery
                  ? 'Try a different search.'
                  : 'Create a group to split a trip, a flat, or a night out.'
              }
              action={
                !groupQuery && (
                  <Button to="/app/groups/new" size="sm" className="!rounded-full">
                    Create a group
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <ul className="space-y-3">
            {visibleGroups.slice(0, 4).map((group) => (
              <li key={group.id}>
                <GroupTile group={group} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Your money --------------------------------------------------- */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Your money</h2>
          <Tabs
            value={period}
            onChange={setPeriod}
            options={PERIODS}
            ariaLabel="Summary period"
            className="w-auto"
          />
        </div>

        {summary.loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : summary.error ? (
          <ErrorState
            error={summary.error}
            onRetry={summary.reload}
            title="Could not load your summary"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Income"
              amountPaise={summary.data.totalIncomePaise}
              tone="positive"
              hint={periodLabel}
            />
            <StatTile
              label="Spent"
              amountPaise={summary.data.totalExpensePaise}
              tone="negative"
              hint={`${summary.data.expenseCount} transaction${
                summary.data.expenseCount === 1 ? '' : 's'
              }`}
            />
            <StatTile
              label="Balance"
              amountPaise={summary.data.balancePaise}
              tone={summary.data.balancePaise >= 0 ? 'accent' : 'negative'}
              hint={
                summary.data.savingsRateBasisPoints !== null
                  ? `${(summary.data.savingsRateBasisPoints / 100).toFixed(0)}% of income kept`
                  : 'Income minus spending'
              }
            />
          </div>
        )}
      </section>

      {/* --- Shared totals ------------------------------------------------- */}
      {groups.data && groups.data.groups.length > 0 && (
        <section className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-positive/25 bg-positive/5 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
              You are owed
            </p>
            <p className="tabular mt-1.5 text-2xl font-extrabold text-positive">
              {formatMoney(groups.data.totals.owedToUserPaise)}
            </p>
          </div>
          <div className="rounded-2xl border border-negative/25 bg-negative/5 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">You owe</p>
            <p className="tabular mt-1.5 text-2xl font-extrabold text-negative">
              {formatMoney(groups.data.totals.userOwesPaise)}
            </p>
          </div>
        </section>
      )}

      {/* --- Charts --------------------------------------------------------- */}
      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Spending over time" subtitle={periodLabel} />
          {daily.loading ? (
            <div className="skeleton h-[200px] w-full" />
          ) : daily.error ? (
            <ErrorState error={daily.error} onRetry={daily.reload} />
          ) : daily.data.days.length === 0 ? (
            <EmptyState
              icon="chart"
              title="Nothing to chart yet"
              description="Add a transaction and this fills in."
            />
          ) : (
            <DailyTrendChart days={daily.data.days} />
          )}
        </Card>

        <Card>
          <CardHeader title="Where it went" subtitle={periodLabel} />
          {categories.loading ? (
            <div className="skeleton h-[240px] w-full" />
          ) : categories.error ? (
            <ErrorState error={categories.error} onRetry={categories.reload} />
          ) : categories.data.categories.length === 0 ? (
            <EmptyState
              icon="chart"
              title="No spending recorded"
              description="Your category breakdown appears here."
            />
          ) : (
            <CategoryChart categories={categories.data.categories.slice(0, 7)} />
          )}
        </Card>
      </section>

      {/* --- Recent activity ------------------------------------------------- */}
      <section>
        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Button to="/app/transactions" variant="ghost" size="sm">
                See all
              </Button>
            }
          />
          {recent.loading ? (
            <ListSkeleton rows={4} />
          ) : recent.error ? (
            <ErrorState error={recent.error} onRetry={recent.reload} />
          ) : recent.data.length === 0 ? (
            <EmptyState
              icon="wallet"
              title="No transactions yet"
              description="Record your first income or expense to get started."
              action={
                <Button to="/app/transactions/new" size="sm" className="!rounded-full">
                  Add a transaction
                </Button>
              }
            />
          ) : (
            <ul className="-mx-1">
              {recent.data.map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}

/**
 * The olive group tile: name, what the group has spent, who is in it, and a
 * badge saying whether the signed-in user is square or still owes something.
 */
function GroupTile({ group }) {
  const net = group.myNetBalancePaise;
  return (
    <Link
      to={`/app/groups/${group.id}`}
      className="tile-accent block p-4 transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-base font-extrabold uppercase tracking-wide">
          {group.name}
        </h3>
        {group.members && <AvatarStack people={group.members} max={3} />}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-onAccent/80">Bill Amount</p>
          <p className="tabular mt-0.5 text-3xl font-extrabold leading-none">
            {formatMoney(group.totalExpensePaise, { hideDecimals: true })}
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
            net === 0 ? 'bg-surface-raised text-positive' : 'bg-surface-raised text-ink'
          }`}
        >
          {net === 0 ? (
            <>
              <CheckGlyph /> SETTLED
            </>
          ) : net > 0 ? (
            <>+{formatMoney(net, { hideDecimals: true })}</>
          ) : (
            <span className="text-negative">-{formatMoney(-net, { hideDecimals: true })}</span>
          )}
        </span>
      </div>
    </Link>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
