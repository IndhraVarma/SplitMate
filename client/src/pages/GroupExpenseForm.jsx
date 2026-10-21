import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGroup } from '../layouts/GroupLayout.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import * as groupService from '../services/group.service.js';
import {
  Button,
  Card,
  Field,
  TextInput,
  TextArea,
  Select,
  MoneyInput,
  Tabs,
  Avatar,
  Badge,
  ConfirmDialog,
  Spinner,
  ErrorState,
} from '../components/ui/index.js';
import { EXPENSE_CATEGORIES, SPLIT_TYPES } from '../utils/constants.js';
import { titleCase, todayInputValue, toDateInputValue } from '../utils/format.js';
import {
  formatMoney,
  toPaise,
  paiseToInputString,
  computeShares,
  percentToBasisPoints,
  basisPointsToPercent,
  MoneyError,
} from '../utils/money.js';

/**
 * Add or edit a shared expense.
 *
 * The live preview under the participant list is computed with the SAME
 * functions the API uses (imported from /shared), so what the user sees before
 * saving is exactly what gets stored - including which person receives the
 * indivisible paise on an uneven equal split.
 */
export default function GroupExpenseForm() {
  const { groupId, id } = useParams();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Edit expense' : 'Add expense');

  const { activeMembers, currentUserId, reloadGroup } = useGroup();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(() => ({
    description: '',
    amount: '',
    category: 'food',
    date: todayInputValue(),
    paidBy: currentUserId || '',
    splitType: 'EQUAL',
    notes: '',
  }));
  // userId -> { selected, amount, percent }
  const [participants, setParticipants] = useState(() =>
    Object.fromEntries(
      activeMembers.map((m) => [m.userId, { selected: true, amount: '', percent: '' }])
    )
  );

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    setLoading(true);
    groupService
      .getExpense(groupId, id)
      .then(({ data }) => {
        if (cancelled) return;
        const e = data.expense;
        setForm({
          description: e.description,
          amount: paiseToInputString(e.amountPaise),
          category: e.category,
          date: toDateInputValue(e.date),
          paidBy: e.paidBy.userId,
          splitType: e.splitType,
          notes: e.notes || '',
        });
        const byUser = Object.fromEntries(
          activeMembers.map((m) => [m.userId, { selected: false, amount: '', percent: '' }])
        );
        for (const share of e.shares) {
          byUser[share.userId] = {
            selected: true,
            amount: paiseToInputString(share.amountPaise),
            percent:
              share.basisPoints !== null && share.basisPoints !== undefined
                ? String(basisPointsToPercent(share.basisPoints))
                : '',
          };
        }
        setParticipants(byUser);
      })
      .catch((error) => !cancelled && setLoadError(error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, id, isEdit]);

  const selectedIds = useMemo(
    () =>
      activeMembers
        .map((m) => m.userId)
        .filter((userId) => participants[userId]?.selected)
        // Sorted so the preview matches the server's deterministic allocation.
        .sort((a, b) => a.localeCompare(b)),
    [activeMembers, participants]
  );

  /**
   * Live allocation preview. Any invalid state (percentages that do not reach
   * 100, exact amounts that miss the total) is reported as a message rather
   * than throwing, so the form can explain the problem before submission.
   */
  const preview = useMemo(() => {
    let totalPaise;
    try {
      totalPaise = toPaise(form.amount);
    } catch {
      return { shares: null, error: null, totalPaise: 0 };
    }
    if (totalPaise <= 0 || selectedIds.length === 0) {
      return { shares: null, error: null, totalPaise };
    }

    try {
      const shares = computeShares({
        splitType: form.splitType,
        totalPaise,
        participants: selectedIds.map((userId) => ({
          userId,
          amountPaise:
            form.splitType === 'EXACT'
              ? safeToPaise(participants[userId]?.amount)
              : undefined,
          basisPoints:
            form.splitType === 'PERCENT'
              ? safePercent(participants[userId]?.percent)
              : undefined,
        })),
      });
      return { shares, error: null, totalPaise };
    } catch (error) {
      return {
        shares: null,
        error: error instanceof MoneyError || error.name === 'MoneyError' ? error.message : null,
        totalPaise,
      };
    }
  }, [form.amount, form.splitType, participants, selectedIds]);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const toggleParticipant = (userId) => {
    setParticipants((p) => ({
      ...p,
      [userId]: { ...p[userId], selected: !p[userId]?.selected },
    }));
    setErrors((e) => ({ ...e, participants: undefined }));
  };

  const setParticipantValue = (userId, key) => (event) => {
    const value = event.target.value;
    setParticipants((p) => ({ ...p, [userId]: { ...p[userId], [key]: value } }));
  };

  const selectAll = (selected) => {
    setParticipants((p) =>
      Object.fromEntries(
        activeMembers.map((m) => [m.userId, { ...p[m.userId], selected }])
      )
    );
  };

  /** Spreads the current total evenly into the exact-amount boxes, as a starting point. */
  const prefillExact = () => {
    try {
      const totalPaise = toPaise(form.amount);
      if (totalPaise <= 0 || selectedIds.length === 0) return;
      const shares = computeShares({
        splitType: 'EQUAL',
        totalPaise,
        participants: selectedIds.map((userId) => ({ userId })),
      });
      setParticipants((p) => {
        const next = { ...p };
        for (const share of shares) {
          next[share.userId] = {
            ...next[share.userId],
            amount: paiseToInputString(share.amountPaise),
          };
        }
        return next;
      });
    } catch {
      /* no usable total yet */
    }
  };

  const prefillPercent = () => {
    if (selectedIds.length === 0) return;
    const base = Math.floor(10000 / selectedIds.length);
    setParticipants((p) => {
      const next = { ...p };
      selectedIds.forEach((userId, index) => {
        const bp = index === 0 ? 10000 - base * (selectedIds.length - 1) : base;
        next[userId] = { ...next[userId], percent: String(basisPointsToPercent(bp)) };
      });
      return next;
    });
  };

  const validate = () => {
    const next = {};
    if (!form.description.trim()) next.description = 'Say what this expense was for.';
    try {
      if (toPaise(form.amount) <= 0) next.amount = 'Enter an amount greater than zero.';
    } catch {
      next.amount = 'Enter a valid amount, for example 1250.50.';
    }
    if (!form.date) next.date = 'Pick a date.';
    if (!form.paidBy) next.paidBy = 'Choose who paid.';
    if (selectedIds.length === 0) next.participants = 'Pick at least one person to split with.';
    else if (preview.error) next.participants = preview.error;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const payload = {
      description: form.description.trim(),
      amount: form.amount,
      category: form.category,
      date: form.date,
      paidBy: form.paidBy,
      splitType: form.splitType,
      notes: form.notes.trim(),
      participants: selectedIds.map((userId) => {
        const entry = { userId };
        if (form.splitType === 'EXACT') entry.amount = participants[userId]?.amount || '0';
        if (form.splitType === 'PERCENT') entry.percent = Number(participants[userId]?.percent || 0);
        return entry;
      }),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await groupService.updateExpense(groupId, id, payload);
        toast.success('Expense updated.');
      } else {
        await groupService.createExpense(groupId, payload);
        toast.success('Expense added.');
      }
      reloadGroup();
      navigate(`/app/groups/${groupId}`);
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    try {
      await groupService.deleteExpense(groupId, id);
      toast.success('Expense deleted.');
      reloadGroup();
      navigate(`/app/groups/${groupId}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-accent">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState error={loadError} title="Could not load this expense" />;
  }

  const sharesByUser = new Map((preview.shares || []).map((s) => [s.userId, s.amountPaise]));
  const allocated = (preview.shares || []).reduce((sum, s) => sum + s.amountPaise, 0);
  // What the exact-amount boxes currently add up to, used to tell the user how
  // much is still unallocated while the split does not yet reconcile.
  const exactAllocated = selectedIds.reduce(
    (sum, id) => sum + finiteOr(safeToPaise(participants[id]?.amount), 0),
    0
  );

  return (
    <>
      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative"
            >
              {formError}
            </p>
          )}

          <Field label="What was it for?" error={errors.description} required>
            {({ id: fieldId, describedBy, invalid }) => (
              <TextInput
                id={fieldId}
                name="description"
                placeholder="Seafood dinner"
                value={form.description}
                onChange={update('description')}
                describedBy={describedBy}
                invalid={invalid}
                autoFocus={!isEdit}
                maxLength={200}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total amount" error={errors.amount} required>
              {({ id: fieldId, describedBy, invalid }) => (
                <MoneyInput
                  id={fieldId}
                  name="amount"
                  value={form.amount}
                  onChange={update('amount')}
                  describedBy={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field label="Date" error={errors.date} required>
              {({ id: fieldId, describedBy, invalid }) => (
                <TextInput
                  id={fieldId}
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={update('date')}
                  describedBy={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Who paid?" error={errors.paidBy} required>
              {({ id: fieldId, describedBy, invalid }) => (
                <Select
                  id={fieldId}
                  name="paidBy"
                  value={form.paidBy}
                  onChange={update('paidBy')}
                  describedBy={describedBy}
                  invalid={invalid}
                >
                  {activeMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.userId === currentUserId ? 'You' : m.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Category" error={errors.category}>
              {({ id: fieldId, describedBy }) => (
                <Select
                  id={fieldId}
                  name="category"
                  value={form.category}
                  onChange={update('category')}
                  describedBy={describedBy}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {titleCase(c)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          {/* --- Split ------------------------------------------------------ */}
          <fieldset className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
            <legend className="px-1 text-sm font-semibold text-ink">How should it split?</legend>

            <Tabs
              className="mt-2"
              value={form.splitType}
              onChange={(splitType) => {
                setForm((f) => ({ ...f, splitType }));
                setErrors((e) => ({ ...e, participants: undefined }));
              }}
              options={SPLIT_TYPES.map((s) => ({ value: s.value, label: s.label }))}
              ariaLabel="Split type"
            />
            <p className="mt-2 text-xs text-ink-faint">
              {SPLIT_TYPES.find((s) => s.value === form.splitType)?.hint}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => selectAll(true)}>
                Select everyone
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => selectAll(false)}>
                Clear all
              </Button>
              {form.splitType === 'EXACT' && (
                <Button type="button" variant="ghost" size="sm" onClick={prefillExact}>
                  Fill evenly
                </Button>
              )}
              {form.splitType === 'PERCENT' && (
                <Button type="button" variant="ghost" size="sm" onClick={prefillPercent}>
                  Fill evenly
                </Button>
              )}
            </div>

            <ul className="mt-3 space-y-2">
              {activeMembers.map((member) => {
                const entry = participants[member.userId] || {};
                const share = sharesByUser.get(member.userId);

                // For the slider: how much of the total is still unclaimed by
                // the OTHER participants. Capping each slider at that figure
                // means dragging can never push the allocation over the total -
                // the user only has to use the remainder up.
                const ownPaise = finiteOr(safeToPaise(entry.amount), 0);
                const othersPaise = selectedIds
                  .filter((id) => id !== member.userId)
                  .reduce((sum, id) => sum + finiteOr(safeToPaise(participants[id]?.amount), 0), 0);
                const sliderMax = Math.max(ownPaise, preview.totalPaise - othersPaise, 1);

                return (
                  <li
                    key={member.userId}
                    className={`rounded-xl border p-3 transition-colors ${
                      entry.selected
                        ? 'border-surface-border bg-surface-raised'
                        : 'border-transparent bg-surface-raised/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`participant-${member.userId}`}
                        checked={Boolean(entry.selected)}
                        onChange={() => toggleParticipant(member.userId)}
                        className="h-5 w-5 shrink-0 rounded border-surface-border bg-surface-overlay text-accent focus:ring-accent"
                      />
                      <Avatar name={member.name} color={member.avatarColor} size="sm" />
                      <label
                        htmlFor={`participant-${member.userId}`}
                        className="min-w-0 flex-1 cursor-pointer text-sm font-medium text-ink"
                      >
                        {member.userId === currentUserId ? 'You' : member.name}
                      </label>

                      {entry.selected && share !== undefined && (
                        <span className="tabular shrink-0 text-sm font-semibold text-accent">
                          {formatMoney(share)}
                        </span>
                      )}
                    </div>

                    {entry.selected && form.splitType === 'EXACT' && (
                      <div className="mt-3 space-y-2.5 pl-8">
                        {/* Drag for speed... */}
                        <div className="flex items-center gap-2.5">
                          <span className="tabular shrink-0 text-[11px] font-medium text-ink-faint">
                            {formatMoney(0, { hideDecimals: true })}
                          </span>
                          <input
                            type="range"
                            className="share-slider flex-1"
                            min={0}
                            max={sliderMax}
                            step={100}
                            value={Math.min(ownPaise, sliderMax)}
                            disabled={preview.totalPaise <= 0}
                            aria-label={`Drag to set ${member.name} share`}
                            aria-valuetext={formatMoney(ownPaise)}
                            style={{
                              '--fill': `${sliderMax > 0 ? (Math.min(ownPaise, sliderMax) / sliderMax) * 100 : 0}%`,
                            }}
                            onChange={(event) =>
                              setParticipants((p) => ({
                                ...p,
                                [member.userId]: {
                                  ...p[member.userId],
                                  amount: paiseToInputString(Number(event.target.value)),
                                },
                              }))
                            }
                          />
                          <span className="tabular shrink-0 text-[11px] font-medium text-ink-faint">
                            {formatMoney(preview.totalPaise, { hideDecimals: true })}
                          </span>
                        </div>

                        {/* ...or type for precision. Both write the same value. */}
                        <div>
                          <label className="sr-only" htmlFor={`amount-${member.userId}`}>
                            Amount for {member.name}
                          </label>
                          <MoneyInput
                            id={`amount-${member.userId}`}
                            value={entry.amount || ''}
                            onChange={setParticipantValue(member.userId, 'amount')}
                          />
                        </div>
                      </div>
                    )}

                    {entry.selected && form.splitType === 'PERCENT' && (
                      <div className="relative mt-2.5 pl-8">
                        <label className="sr-only" htmlFor={`percent-${member.userId}`}>
                          Percentage for {member.name}
                        </label>
                        <input
                          id={`percent-${member.userId}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                          className="field tabular tap pr-9"
                          value={entry.percent || ''}
                          onChange={setParticipantValue(member.userId, 'percent')}
                        />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                          %
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Reconciliation line: the invariant made visible. */}
            {preview.totalPaise > 0 && selectedIds.length > 0 && (
              <div
                className={`mt-3 flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm ${
                  preview.shares
                    ? 'border-positive/30 bg-positive/5 text-positive'
                    : 'border-negative/30 bg-negative/5 text-negative'
                }`}
              >
                <span>{preview.shares ? 'Allocated' : 'Does not add up'}</span>
                <span className="tabular font-semibold">
                  {preview.shares
                    ? `${formatMoney(allocated)} of ${formatMoney(preview.totalPaise)}`
                    : form.splitType === 'EXACT'
                      ? `${formatMoney(Math.abs(preview.totalPaise - exactAllocated))} ${
                          exactAllocated > preview.totalPaise ? 'over' : 'left to allocate'
                        }`
                      : preview.error || 'Check the amounts'}
                </span>
              </div>
            )}

            {errors.participants && (
              <p role="alert" className="mt-2 text-xs font-medium text-negative">
                {errors.participants}
              </p>
            )}
          </fieldset>

          <Field label="Notes" hint="Optional">
            {({ id: fieldId, describedBy }) => (
              <TextArea
                id={fieldId}
                name="notes"
                value={form.notes}
                onChange={update('notes')}
                describedBy={describedBy}
                maxLength={500}
              />
            )}
          </Field>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              className="!rounded-full uppercase tracking-wide sm:flex-1"
            >
              {isEdit ? 'Save changes' : 'Add expense'}
              {preview.totalPaise > 0 && (
                <span className="tabular ml-1 font-extrabold">
                  &middot; {formatMoney(preview.totalPaise, { hideDecimals: true })}
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => navigate(`/app/groups/${groupId}`)}
              className="sm:flex-1"
            >
              Cancel
            </Button>
          </div>

          {isEdit && (
            <div className="border-t border-surface-border pt-4">
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete this expense
              </Button>
              <p className="mt-2 text-xs text-ink-faint">
                Everyone&apos;s balance in this group is recalculated immediately.
              </p>
            </div>
          )}
        </form>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title="Delete this expense?"
        description="The group balances will be recalculated without it."
      />
    </>
  );
}

function safeToPaise(value) {
  try {
    return toPaise(value || '0');
  } catch {
    return Number.NaN;
  }
}

/** Treats an unparseable amount as `fallback` for layout maths only. */
function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function safePercent(value) {
  try {
    return percentToBasisPoints(value || 0);
  } catch {
    return Number.NaN;
  }
}
