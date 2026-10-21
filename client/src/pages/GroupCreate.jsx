import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../layouts/PageHeader.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useAsync from '../hooks/useAsync.js';
import { useToast } from '../context/ToastContext.jsx';
import * as groupService from '../services/group.service.js';
import * as authService from '../services/auth.service.js';
import {
  Button,
  Card,
  Field,
  TextInput,
  TextArea,
  Select,
  Avatar,
  Badge,
  Spinner,
} from '../components/ui/index.js';
import { GROUP_TYPES } from '../utils/constants.js';
import { titleCase } from '../utils/format.js';

const COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

export default function GroupCreate() {
  useDocumentTitle('New group');
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'trip',
    accentColor: COLORS[0],
  });
  const [members, setMembers] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Give the group a name (at least 2 characters).';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const { data } = await groupService.createGroup({
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        accentColor: form.accentColor,
        memberIds: members.map((m) => m.id),
      });
      toast.success('Group created.');
      navigate(`/app/groups/${data.group.id}`);
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="New group"
        subtitle="A group holds shared expenses, balances and settlements."
        backTo="/app/groups"
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

          <Field label="Group name" error={errors.name} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="name"
                placeholder="Goa Trip 2026"
                value={form.name}
                onChange={update('name')}
                describedBy={describedBy}
                invalid={invalid}
                autoFocus
              />
            )}
          </Field>

          <Field label="What is it for?" error={errors.type}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                name="type"
                value={form.type}
                onChange={update('type')}
                describedBy={describedBy}
              >
                {GROUP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Description" error={errors.description} hint="Optional">
            {({ id, describedBy }) => (
              <TextArea
                id={id}
                name="description"
                placeholder="Four days, one shared wallet."
                value={form.description}
                onChange={update('description')}
                describedBy={describedBy}
                maxLength={300}
              />
            )}
          </Field>

          <fieldset>
            <legend className="label">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, accentColor: color }))}
                  aria-label={`Use the colour ${color}`}
                  aria-pressed={form.accentColor === color}
                  className={`h-10 w-10 rounded-xl border-2 transition-transform ${
                    form.accentColor === color
                      ? 'scale-105 border-ink'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: `${color}33`, boxShadow: `inset 0 0 0 2px ${color}` }}
                />
              ))}
            </div>
          </fieldset>

          <MemberPicker members={members} onChange={setMembers} />

          <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
            <Button type="submit" size="lg" loading={submitting} className="sm:flex-1">
              Create group
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => navigate('/app/groups')}
              className="sm:flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

/**
 * Finds registered users by name or email. The API only answers queries of
 * three characters or more and returns public fields only, so this cannot be
 * used to page through the whole user list.
 */
export function MemberPicker({ members, onChange, excludeIds = [] }) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 350);

  const results = useAsync(
    () =>
      debounced.trim().length >= 3
        ? authService.searchUsers(debounced.trim()).then((r) => r.data.users)
        : Promise.resolve([]),
    [debounced]
  );

  const chosenIds = new Set([...members.map((m) => m.id), ...excludeIds]);

  const add = (user) => {
    if (chosenIds.has(user.id)) return;
    onChange([...members, user]);
    setQuery('');
  };

  return (
    <div>
      <Field
        label="Add people"
        hint="Search by name or email. You can also invite people later."
        htmlFor="member-search"
      >
        <TextInput
          id="member-search"
          type="search"
          placeholder="Start typing a name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {members.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {members.map((member) => (
            <li key={member.id}>
              <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-overlay py-1 pl-1 pr-2 text-sm">
                <Avatar name={member.name} color={member.avatarColor} size="xs" />
                <span className="text-ink">{member.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(members.filter((m) => m.id !== member.id))}
                  aria-label={`Remove ${member.name}`}
                  className="rounded-full p-0.5 text-ink-faint hover:text-negative"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M6.3 5a.9.9 0 00-1.3 1.3L8.7 10l-3.7 3.7A.9.9 0 106.3 15l3.7-3.7 3.7 3.7a.9.9 0 001.3-1.3L11.3 10 15 6.3A.9.9 0 0013.7 5L10 8.7 6.3 5z" />
                  </svg>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {debounced.trim().length >= 3 && (
        <div className="mt-2 rounded-xl border border-surface-border bg-surface-overlay p-2">
          {results.loading ? (
            <p className="flex items-center gap-2 px-2 py-2 text-sm text-ink-muted">
              <Spinner size="sm" /> Searching...
            </p>
          ) : results.data && results.data.length > 0 ? (
            <ul className="space-y-1">
              {results.data.map((user) => {
                const already = chosenIds.has(user.id);
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => add(user)}
                      disabled={already}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-raised disabled:opacity-50"
                    >
                      <Avatar name={user.name} color={user.avatarColor} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{user.name}</span>
                        <span className="block truncate text-xs text-ink-faint">{user.email}</span>
                      </span>
                      {already && <Badge tone="neutral">Added</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-2 text-sm text-ink-muted">
              No SplitMate accounts match that. You can invite them by email from the group screen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
