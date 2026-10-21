import { useMemo, useState } from 'react';
import PageHeader from '../layouts/PageHeader.jsx';
import useAsync from '../hooks/useAsync.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import * as txService from '../services/transaction.service.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Pagination,
} from '../components/ui/index.js';
import TransactionRow from '../components/transactions/TransactionRow.jsx';
import TransactionFilters from '../components/transactions/TransactionFilters.jsx';
import NavIcon from '../components/NavIcon.jsx';
import { formatMoney } from '../utils/money.js';
import { formatRelativeDay } from '../utils/format.js';

const EMPTY_FILTERS = { search: '', type: '', category: '', from: '', to: '', page: 1 };

export default function Transactions() {
  useDocumentTitle('Activity');
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // The search box updates on every keystroke; the request waits for a pause.
  const debouncedSearch = useDebouncedValue(filters.search, 350);

  const query = useMemo(() => {
    const q = { page: filters.page, limit: 20 };
    if (debouncedSearch) q.search = debouncedSearch;
    if (filters.type) q.type = filters.type;
    if (filters.category) q.category = filters.category;
    if (filters.from) q.from = filters.from;
    if (filters.to) q.to = filters.to;
    return q;
  }, [debouncedSearch, filters.type, filters.category, filters.from, filters.to, filters.page]);

  const list = useAsync(() => txService.listTransactions(query), [query]);

  const groupedByDay = useMemo(() => {
    const items = list.data?.data?.transactions || [];
    const groups = new Map();
    for (const t of items) {
      const key = String(t.date).slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    return [...groups.entries()];
  }, [list.data]);

  const hasFilters = Boolean(
    filters.search || filters.type || filters.category || filters.from || filters.to
  );

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Every income and expense you have recorded."
        action={
          <Button to="/app/transactions/new" size="sm">
            <NavIcon name="plus" className="h-4 w-4" />
            Add
          </Button>
        }
      />

      <TransactionFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      <Card className="mt-4">
        {list.loading && !list.data ? (
          <ListSkeleton rows={6} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : groupedByDay.length === 0 ? (
          <EmptyState
            icon={hasFilters ? 'search' : 'wallet'}
            title={hasFilters ? 'Nothing matches those filters' : 'No transactions yet'}
            description={
              hasFilters
                ? 'Try a wider date range, or clear the filters to see everything.'
                : 'Add your first income or expense and it will show up here.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              ) : (
                <Button to="/app/transactions/new" size="sm">
                  Add a transaction
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className={list.loading ? 'opacity-60 transition-opacity' : ''}>
              {groupedByDay.map(([day, items]) => (
                <section key={day} className="mb-4 last:mb-0">
                  <header className="mb-1 flex items-baseline justify-between px-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      {formatRelativeDay(day)}
                    </h2>
                    <span className="tabular text-xs text-ink-faint">{dayTotal(items)}</span>
                  </header>
                  <ul className="-mx-1 divide-y divide-surface-border/60">
                    {items.map((t) => (
                      <TransactionRow key={t.id} transaction={t} showDate={false} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <Pagination
              meta={list.data.meta}
              onChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </Card>
    </>
  );
}

/** Net movement for a single day, shown beside the date heading. */
function dayTotal(items) {
  const net = items.reduce(
    (acc, t) => acc + (t.type === 'income' ? t.amountPaise : -t.amountPaise),
    0
  );
  return `${net >= 0 ? '+' : '-'}${formatMoney(Math.abs(net))}`;
}
