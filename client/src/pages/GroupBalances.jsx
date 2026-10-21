import { useState } from 'react';
import { useGroup } from '../layouts/GroupLayout.jsx';
import useAsync from '../hooks/useAsync.js';
import { useToast } from '../context/ToastContext.jsx';
import useIdempotencyKey from '../hooks/useIdempotencyKey.js';
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
  StatTile,
  Modal,
  Field,
  MoneyInput,
  Select,
  TextInput,
  Tabs,
} from '../components/ui/index.js';
import NavIcon from '../components/NavIcon.jsx';
import { formatMoney, paiseToInputString, toPaise } from '../utils/money.js';
import { SETTLEMENT_METHODS } from '../utils/constants.js';
import { titleCase, todayInputValue } from '../utils/format.js';

const VIEWS = [
  { value: 'simplified', label: 'Fewest transfers' },
  { value: 'direct', label: 'Who owes whom' },
];

/**
 * Balances screen.
 *
 * Shows three distinct things, deliberately kept apart:
 *  - each member's NET BALANCE (what the group owes them, or they owe it)
 *  - the DEBTS between members, either direct or simplified
 *  - a way to record a SETTLEMENT, which is an accounting entry, not a payment
 */
export default function GroupBalances() {
  const { groupId, currentUserId, reloadGroup } = useGroup();
  const toast = useToast();
  const [view, setView] = useState('simplified');
  const [settling, setSettling] = useState(null);

  const balances = useAsync(() => groupService.getBalances(groupId).then((r) => r.data), [groupId]);

  const onSettled = () => {
    setSettling(null);
    balances.reload();
    reloadGroup();
  };

  if (balances.loading && !balances.data) return <ListSkeleton rows={4} />;
  if (balances.error) return <ErrorState error={balances.error} onRetry={balances.reload} />;

  const { netBalances, simplifiedDebts, pairwiseDebts, totals } = balances.data;
  const debts = view === 'simplified' ? simplifiedDebts : pairwiseDebts;
  const myBalance = netBalances.find((b) => b.userId === currentUserId);
  const everyoneSquare = netBalances.every((b) => b.amountPaise === 0);

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Total spent" amountPaise={totals.totalExpensePaise} hint={`${totals.expenseCount} expenses`} />
        <StatTile
          label="Settled so far"
          amountPaise={totals.totalSettledPaise}
          hint={`${totals.settlementCount} settlements`}
        />
        <StatTile
          label="Your position"
          amountPaise={Math.abs(myBalance?.amountPaise || 0)}
          tone={
            !myBalance || myBalance.amountPaise === 0
              ? 'neutral'
              : myBalance.amountPaise > 0
                ? 'positive'
                : 'negative'
          }
          hint={
            !myBalance || myBalance.amountPaise === 0
              ? 'You are all square'
              : myBalance.amountPaise > 0
                ? 'owed to you'
                : 'you owe'
          }
        />
      </div>

      {/* --- Net balance per member -------------------------------------- */}
      <Card className="mb-4">
        <CardHeader
          title="Net balances"
          subtitle="Everything paid, minus every share, adjusted for settlements."
        />
        <ul className="space-y-1">
          {netBalances.map((balance) => (
            <li
              key={balance.userId}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-overlay"
            >
              <Avatar name={balance.name} color={balance.avatarColor} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {balance.userId === currentUserId ? 'You' : balance.name}
                </span>
                {balance.status === 'removed' && (
                  <span className="text-xs text-ink-faint">no longer in the group</span>
                )}
              </span>
              {balance.amountPaise === 0 ? (
                <Badge tone="neutral">Settled</Badge>
              ) : (
                <span
                  className={`tabular text-sm font-semibold ${
                    balance.amountPaise > 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {balance.amountPaise > 0 ? 'gets back ' : 'owes '}
                  {formatMoney(Math.abs(balance.amountPaise))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* --- Debts -------------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Settling up"
          subtitle={
            view === 'simplified'
              ? 'The shortest set of transfers that clears every balance.'
              : 'The actual obligations between each pair of people.'
          }
        />

        <Tabs value={view} onChange={setView} options={VIEWS} ariaLabel="Debt view" className="mb-4" />

        {everyoneSquare ? (
          <EmptyState
            icon="check"
            title="Everyone is square"
            description="No outstanding balances in this group."
          />
        ) : debts.length === 0 ? (
          <EmptyState icon="check" title="Nothing left to settle" />
        ) : (
          <ul className="space-y-2">
            {debts.map((debt) => {
              const involvesMe =
                debt.from.userId === currentUserId || debt.to.userId === currentUserId;
              return (
                <li
                  key={`${debt.from.userId}-${debt.to.userId}`}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${
                    involvesMe
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-surface-border bg-surface-overlay/40'
                  }`}
                >
                  <Avatar name={debt.from.name} color={debt.from.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-ink">
                      {debt.from.userId === currentUserId ? 'You' : debt.from.name}
                    </span>
                    <span className="text-ink-muted">
                      {debt.from.userId === currentUserId ? ' owe ' : ' owes '}
                    </span>
                    <span className="font-medium text-ink">
                      {debt.to.userId === currentUserId ? 'you' : debt.to.name}
                    </span>
                  </span>
                  <span className="tabular shrink-0 font-semibold text-ink">
                    {formatMoney(debt.amountPaise)}
                  </span>
                  <Button
                    size="sm"
                    variant={involvesMe ? 'primary' : 'secondary'}
                    onClick={() => setSettling(debt)}
                  >
                    <NavIcon name="settle" className="h-4 w-4" />
                    Settle
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 rounded-xl border border-surface-border bg-surface-overlay/40 px-3.5 py-3 text-xs leading-relaxed text-ink-faint">
          SplitMate does not move money. Recording a settlement writes down that a repayment
          happened - pay each other however you normally do.
          {view === 'simplified' &&
            ' Simplified transfers may pair people who never shared an expense; the "Who owes whom" tab shows the direct obligations.'}
        </p>
      </Card>

      <SettleDialog
        open={Boolean(settling)}
        debt={settling}
        groupId={groupId}
        currentUserId={currentUserId}
        onClose={() => setSettling(null)}
        onSettled={onSettled}
        onError={(message) => toast.error(message)}
        onSuccess={(message) => toast.success(message)}
      />
    </>
  );
}

/**
 * Records a full or partial settlement.
 *
 * The amount defaults to the full outstanding debt but can be reduced - a
 * partial repayment is an ordinary case, not an error. An idempotency key is
 * sent so a double tap does not record the repayment twice.
 */
function SettleDialog({ open, debt, groupId, currentUserId, onClose, onSettled, onError, onSuccess }) {
  const { key, reset } = useIdempotencyKey();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [note, setNote] = useState('');
  const [settledAt, setSettledAt] = useState(todayInputValue());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(null);

  if (open && seeded !== debt) {
    setSeeded(debt);
    setAmount(debt ? paiseToInputString(debt.amountPaise) : '');
    setMethod('upi');
    setNote('');
    setSettledAt(todayInputValue());
    setError(null);
  }

  if (!debt) return null;

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    let paise;
    try {
      paise = toPaise(amount);
    } catch {
      setError('Enter a valid amount, for example 1250.50.');
      return;
    }
    if (paise <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (paise > debt.amountPaise) {
      setError(
        `That is more than the ${formatMoney(debt.amountPaise)} outstanding. Enter that or less.`
      );
      return;
    }

    setSaving(true);
    try {
      const { data } = await groupService.createSettlement(groupId, {
        fromUser: debt.from.userId,
        toUser: debt.to.userId,
        amount,
        method,
        note: note.trim(),
        settledAt,
        clientRequestId: key,
      });
      reset();
      onSuccess(
        data.duplicate
          ? 'That settlement was already recorded.'
          : paise === debt.amountPaise
            ? 'Settled up in full.'
            : 'Partial settlement recorded.'
      );
      onSettled();
    } catch (err) {
      setError(err.message);
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fromLabel = debt.from.userId === currentUserId ? 'You' : debt.from.name;
  const toLabel = debt.to.userId === currentUserId ? 'you' : debt.to.name;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a settlement"
      description={`${fromLabel} ${debt.from.userId === currentUserId ? 'pay' : 'pays'} ${toLabel}.`}
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

        <div className="rounded-xl border border-surface-border bg-surface-overlay px-3.5 py-3 text-sm">
          <span className="text-ink-muted">Outstanding</span>
          <span className="tabular float-right font-semibold text-ink">
            {formatMoney(debt.amountPaise)}
          </span>
        </div>

        <Field label="Amount settled" hint="Less than the full amount records a partial repayment." required>
          {({ id, describedBy }) => (
            <MoneyInput
              id={id}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              describedBy={describedBy}
              data-autofocus
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How?">
            {({ id, describedBy }) => (
              <Select
                id={id}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                describedBy={describedBy}
              >
                {SETTLEMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {titleCase(m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="When?">
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                type="date"
                value={settledAt}
                onChange={(e) => setSettledAt(e.target.value)}
                describedBy={describedBy}
              />
            )}
          </Field>
        </div>

        <Field label="Note" hint="Optional">
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              describedBy={describedBy}
              placeholder="Sent over UPI"
              maxLength={200}
            />
          )}
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Record settlement
          </Button>
        </div>
      </form>
    </Modal>
  );
}
