import { useMemo, useState } from 'react';
import PageHeader from '../layouts/PageHeader.jsx';
import useAsync from '../hooks/useAsync.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { useToast } from '../context/ToastContext.jsx';
import * as budgetService from '../services/budget.service.js';
import * as txService from '../services/transaction.service.js';
import {
  Button,
  Card,
  CardHeader,
  Field,
  Select,
  MoneyInput,
  Modal,
  ProgressBar,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Badge,
  ConfirmDialog,
  StatTile,
} from '../components/ui/index.js';
import TrendChart from '../components/charts/TrendChart.jsx';
import CategoryChart from '../components/charts/CategoryChart.jsx';
import NavIcon from '../components/NavIcon.jsx';
import { EXPENSE_CATEGORIES } from '../utils/constants.js';
import { formatMoney, toPaise, paiseToInputString } from '../utils/money.js';
import { titleCase, monthName, MONTH_NAMES } from '../utils/format.js';

export default function Budgets() {
  useDocumentTitle('Budgets and analytics');
  const toast = useToast();

  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const period = useMemo(() => ({ year, month }), [year, month]);

  const budgets = useAsync(
    () => budgetService.getBudgetSummary(period).then((r) => r.data),
    [period]
  );
  const trend = useAsync(() => txService.getMonthlyTrend({ year }).then((r) => r.data), [year]);
  const categories = useAsync(
    () => txService.getCategoryBreakdown(period).then((r) => r.data),
    [period]
  );

  const years = useMemo(() => {
    const current = now.getUTCFullYear();
    return [current + 1, current, current - 1, current - 2];
  }, [now]);

  const saveBudget = async (payload) => {
    await budgetService.saveBudget(payload);
    toast.success('Budget saved.');
    setEditing(null);
    budgets.reload();
  };

  const removeBudget = async () => {
    await budgetService.deleteBudget(deleting.id);
    toast.success('Budget removed.');
    setDeleting(null);
    budgets.reload();
  };

  const totals = budgets.data?.totals;

  return (
    <>
      <PageHeader
        title="Budgets and analytics"
        subtitle="Set a monthly cap per category and see the real number against it."
        action={
          <Button size="sm" onClick={() => setEditing({ category: '', limit: '' })}>
            <NavIcon name="plus" className="h-4 w-4" />
            Set budget
          </Button>
        }
      />

      {/* --- Period picker ------------------------------------------------ */}
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label text-xs" htmlFor="budget-month">
              Month
            </label>
            <Select
              id="budget-month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="budget-year">
              Year
            </label>
            <Select id="budget-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* --- Budget roll-up ----------------------------------------------- */}
      {totals && totals.totalLimitPaise > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatTile label="Budgeted" amountPaise={totals.totalLimitPaise} />
          <StatTile label="Spent" amountPaise={totals.totalSpentPaise} tone="negative" />
          <StatTile
            label="Left"
            amountPaise={totals.remainingPaise}
            tone={totals.remainingPaise >= 0 ? 'positive' : 'negative'}
            hint={
              totals.overBudgetCount > 0
                ? `${totals.overBudgetCount} category over budget`
                : 'Still within budget'
            }
          />
        </div>
      )}

      {/* --- Budget list --------------------------------------------------- */}
      <Card>
        <CardHeader
          title={`${monthName(month)} ${year} budgets`}
          subtitle="Spending is counted from your personal transactions only."
        />
        {budgets.loading ? (
          <ListSkeleton rows={3} />
        ) : budgets.error ? (
          <ErrorState error={budgets.error} onRetry={budgets.reload} />
        ) : budgets.data.items.length === 0 ? (
          <EmptyState
            icon="budgets"
            title="No budgets set for this month"
            description="Pick a category and a monthly cap. SplitMate tracks the rest."
            action={
              <Button size="sm" onClick={() => setEditing({ category: '', limit: '' })}>
                Set your first budget
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {budgets.data.items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-surface-border bg-surface-overlay/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{titleCase(item.category)}</p>
                    <p className="tabular mt-0.5 text-xs text-ink-muted">
                      {formatMoney(item.spentPaise)} of {formatMoney(item.limitPaise)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.isOverBudget ? (
                      <Badge tone="negative">
                        {formatMoney(Math.abs(item.remainingPaise))} over
                      </Badge>
                    ) : (
                      <Badge tone="positive">{formatMoney(item.remainingPaise)} left</Badge>
                    )}
                  </div>
                </div>

                <ProgressBar
                  className="mt-3"
                  basisPoints={item.usedBasisPoints}
                  over={item.isOverBudget}
                  label={`${titleCase(item.category)} budget used`}
                />

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        category: item.category,
                        limit: paiseToInputString(item.limitPaise),
                      })
                    }
                  >
                    <NavIcon name="edit" className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(item)}>
                    <NavIcon name="trash" className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {budgets.data?.unbudgetedSpending?.length > 0 && (
          <div className="mt-5 border-t border-surface-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Spending with no budget set
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {budgets.data.unbudgetedSpending.map((u) => (
                <li key={u.category}>
                  <button
                    type="button"
                    onClick={() => setEditing({ category: u.category, limit: '' })}
                    className="rounded-full border border-surface-border bg-surface-overlay px-3 py-1.5 text-xs text-ink-muted hover:border-accent/40 hover:text-accent"
                  >
                    {titleCase(u.category)} &middot; {formatMoney(u.spentPaise)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* --- Analytics ----------------------------------------------------- */}
      <section className="mt-5 grid gap-4">
        <Card>
          <CardHeader title="Income and spending by month" subtitle={String(year)} />
          {trend.loading ? (
            <div className="skeleton h-[260px] w-full" />
          ) : trend.error ? (
            <ErrorState error={trend.error} onRetry={trend.reload} />
          ) : (
            <TrendChart months={trend.data.months} />
          )}
        </Card>

        <Card>
          <CardHeader title="Category breakdown" subtitle={`${monthName(month)} ${year}`} />
          {categories.loading ? (
            <div className="skeleton h-[240px] w-full" />
          ) : categories.error ? (
            <ErrorState error={categories.error} onRetry={categories.reload} />
          ) : categories.data.categories.length === 0 ? (
            <EmptyState
              icon="chart"
              title="No spending this month"
              description="Once you record expenses, the split appears here."
            />
          ) : (
            <CategoryChart categories={categories.data.categories} />
          )}
        </Card>
      </section>

      <BudgetDialog
        open={Boolean(editing)}
        initial={editing}
        year={year}
        month={month}
        existingCategories={(budgets.data?.items || []).map((i) => i.category)}
        onClose={() => setEditing(null)}
        onSave={saveBudget}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={removeBudget}
        title={`Remove the ${deleting ? titleCase(deleting.category) : ''} budget?`}
        description="Your transactions are not affected - only the cap is removed."
        confirmLabel="Remove budget"
      />
    </>
  );
}

/** Create / edit a single category budget. */
function BudgetDialog({ open, initial, year, month, existingCategories, onClose, onSave }) {
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Re-seed the form each time the dialog opens.
  const [seeded, setSeeded] = useState(null);
  if (open && seeded !== initial) {
    setSeeded(initial);
    setCategory(initial?.category || '');
    setLimit(initial?.limit || '');
    setError(null);
  }

  const isEdit = Boolean(initial?.id);
  const available = EXPENSE_CATEGORIES.filter(
    (c) => c === category || !existingCategories.includes(c)
  );

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!category) {
      setError('Pick a category.');
      return;
    }
    try {
      if (toPaise(limit) <= 0) {
        setError('Enter a budget greater than zero.');
        return;
      }
    } catch {
      setError('Enter a valid amount, for example 5000.');
      return;
    }

    setSaving(true);
    try {
      await onSave({ category, year, month, limit });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit budget' : 'Set a budget'}
      description={`For ${monthName(month)} ${year}.`}
      size="sm"
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative"
          >
            {error}
          </p>
        )}

        <Field label="Category" required>
          {({ id, describedBy }) => (
            <Select
              id={id}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              describedBy={describedBy}
              disabled={isEdit}
              data-autofocus
            >
              <option value="">Choose a category</option>
              {available.map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Monthly limit" required>
          {({ id, describedBy }) => (
            <MoneyInput
              id={id}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              describedBy={describedBy}
            />
          )}
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save budget
          </Button>
        </div>
      </form>
    </Modal>
  );
}
