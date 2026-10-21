import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../layouts/PageHeader.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { useToast } from '../context/ToastContext.jsx';
import * as txService from '../services/transaction.service.js';
import {
  Button,
  Card,
  Field,
  TextInput,
  TextArea,
  Select,
  MoneyInput,
  Tabs,
  ConfirmDialog,
  Spinner,
  ErrorState,
} from '../components/ui/index.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../utils/constants.js';
import { titleCase, todayInputValue, toDateInputValue } from '../utils/format.js';
import { paiseToInputString, toPaise } from '../utils/money.js';

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

const blankForm = () => ({
  type: 'expense',
  amount: '',
  category: 'food',
  description: '',
  paymentMethod: 'upi',
  date: todayInputValue(),
  notes: '',
});

/** One screen for both creating and editing - the only difference is the load. */
export default function TransactionForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Edit transaction' : 'Add transaction');

  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(blankForm);
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
    txService
      .getTransaction(id)
      .then(({ data }) => {
        if (cancelled) return;
        const t = data.transaction;
        setForm({
          type: t.type,
          amount: paiseToInputString(t.amountPaise),
          category: t.category,
          description: t.description || '',
          paymentMethod: t.paymentMethod || 'other',
          date: toDateInputValue(t.date),
          notes: t.notes || '',
        });
      })
      .catch((error) => !cancelled && setLoadError(error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const update = (field) => (event) => {
    const value = event.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /** Switching type resets the category, since the two lists barely overlap. */
  const changeType = (type) => {
    setForm((f) => ({
      ...f,
      type,
      category: type === 'income' ? 'salary' : 'food',
    }));
    setErrors((e) => ({ ...e, category: undefined }));
  };

  const validate = () => {
    const next = {};
    try {
      const paise = toPaise(form.amount);
      if (paise <= 0) next.amount = 'Enter an amount greater than zero.';
    } catch {
      next.amount = 'Enter a valid amount, for example 450.75.';
    }
    if (!form.category) next.category = 'Pick a category.';
    if (!form.date) next.date = 'Pick a date.';
    if (form.description.length > 200) next.description = 'Keep this under 200 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const payload = {
      type: form.type,
      amount: form.amount,
      category: form.category,
      description: form.description.trim(),
      paymentMethod: form.paymentMethod,
      date: form.date,
      notes: form.notes.trim(),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await txService.updateTransaction(id, payload);
        toast.success('Transaction updated.');
      } else {
        await txService.createTransaction(payload);
        toast.success('Transaction added.');
      }
      navigate('/app/transactions');
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    try {
      await txService.deleteTransaction(id);
      toast.success('Transaction deleted.');
      navigate('/app/transactions');
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
    return (
      <>
        <PageHeader title="Edit transaction" backTo="/app/transactions" />
        <ErrorState error={loadError} title="Could not load this transaction" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit transaction' : 'Add a transaction'}
        subtitle={isEdit ? 'Change anything and save.' : 'Record money in or money out.'}
        backTo="/app/transactions"
      />

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

          <Tabs
            value={form.type}
            onChange={changeType}
            options={TYPE_OPTIONS}
            ariaLabel="Transaction type"
          />

          <Field label="Amount" error={errors.amount} required>
            {({ id: fieldId, describedBy, invalid }) => (
              <MoneyInput
                id={fieldId}
                name="amount"
                value={form.amount}
                onChange={update('amount')}
                describedBy={describedBy}
                invalid={invalid}
                autoFocus={!isEdit}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" error={errors.category} required>
              {({ id: fieldId, describedBy, invalid }) => (
                <Select
                  id={fieldId}
                  name="category"
                  value={form.category}
                  onChange={update('category')}
                  describedBy={describedBy}
                  invalid={invalid}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {titleCase(c)}
                    </option>
                  ))}
                </Select>
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

          <Field label="Description" error={errors.description} hint="What was this for?">
            {({ id: fieldId, describedBy, invalid }) => (
              <TextInput
                id={fieldId}
                name="description"
                placeholder="Lunch with the team"
                value={form.description}
                onChange={update('description')}
                describedBy={describedBy}
                invalid={invalid}
                maxLength={200}
              />
            )}
          </Field>

          <Field label="Paid with" error={errors.paymentMethod}>
            {({ id: fieldId, describedBy }) => (
              <Select
                id={fieldId}
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={update('paymentMethod')}
                describedBy={describedBy}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {titleCase(m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Notes" error={errors.notes} hint="Optional">
            {({ id: fieldId, describedBy }) => (
              <TextArea
                id={fieldId}
                name="notes"
                placeholder="Anything worth remembering"
                value={form.notes}
                onChange={update('notes')}
                describedBy={describedBy}
                maxLength={500}
              />
            )}
          </Field>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
            <Button type="submit" size="lg" loading={submitting} className="sm:flex-1">
              {isEdit ? 'Save changes' : 'Add transaction'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => navigate('/app/transactions')}
              className="sm:flex-1"
            >
              Cancel
            </Button>
          </div>

          {isEdit && (
            <div className="border-t border-surface-border pt-4">
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete this transaction
              </Button>
            </div>
          )}
        </form>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title="Delete this transaction?"
        description="It will be removed from your totals and charts."
      />
    </>
  );
}
