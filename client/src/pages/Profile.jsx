import { useState } from 'react';
import PageHeader from '../layouts/PageHeader.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as authService from '../services/auth.service.js';
import {
  Button,
  Card,
  CardHeader,
  Field,
  TextInput,
  Avatar,
  ConfirmDialog,
} from '../components/ui/index.js';
import NavIcon from '../components/NavIcon.jsx';
import { formatDate } from '../utils/format.js';

const COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899'];

export default function Profile() {
  useDocumentTitle('Profile and settings');
  const { user, setUser, signOut } = useAuth();
  const toast = useToast();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  return (
    <>
      <PageHeader title="Profile and settings" subtitle="Your account details." />

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name} color={user?.avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-ink">{user?.name}</p>
            <p className="truncate text-sm text-ink-muted">{user?.email}</p>
            {user?.createdAt && (
              <p className="mt-0.5 text-xs text-ink-faint">
                Member since {formatDate(user.createdAt)}
              </p>
            )}
          </div>
        </div>
      </Card>

      <ProfileForm user={user} setUser={setUser} toast={toast} />
      <PasswordForm toast={toast} />

      <Card className="mt-4">
        <CardHeader title="Currency" subtitle="SplitMate currently works in Indian rupees only." />
        <p className="text-sm text-ink-muted">
          All amounts are stored as whole paise, so nothing is ever lost to rounding. Support for
          other currencies is on the roadmap - the formatting and conversion layer is already
          centralised for it.
        </p>
      </Card>

      <Card className="mt-4 border-negative/25">
        <CardHeader title="Sign out" subtitle="You can sign back in at any time." />
        <Button variant="danger" onClick={() => setConfirmSignOut(true)}>
          <NavIcon name="logout" className="h-4 w-4" />
          Sign out
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={signOut}
        title="Sign out of SplitMate?"
        description="Your data stays exactly as it is."
        confirmLabel="Sign out"
        variant="danger"
      />
    </>
  );
}

function ProfileForm({ user, setUser, toast }) {
  const [name, setName] = useState(user?.name || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || COLORS[0]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const dirty = name !== user?.name || avatarColor !== user?.avatarColor;

  const submit = async (event) => {
    event.preventDefault();
    setErrors({});
    if (name.trim().length < 2) {
      setErrors({ name: 'Your name must be at least 2 characters.' });
      return;
    }
    setSaving(true);
    try {
      const { data } = await authService.updateProfile({ name: name.trim(), avatarColor });
      setUser(data.user);
      toast.success('Profile updated.');
    } catch (error) {
      setErrors(error.fieldErrors || {});
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader title="Your details" />
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Display name" error={errors.name} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              maxLength={60}
            />
          )}
        </Field>

        <Field label="Email address" hint="Your email cannot be changed.">
          {({ id }) => <TextInput id={id} value={user?.email || ''} readOnly disabled />}
        </Field>

        <fieldset>
          <legend className="label">Avatar colour</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAvatarColor(color)}
                aria-label={`Use the colour ${color}`}
                aria-pressed={avatarColor === color}
                className={`h-10 w-10 rounded-xl border-2 transition-transform ${
                  avatarColor === color ? 'scale-105 border-ink' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: `${color}33`, boxShadow: `inset 0 0 0 2px ${color}` }}
              />
            ))}
          </div>
        </fieldset>

        <Button type="submit" loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm({ toast }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.currentPassword) next.currentPassword = 'Enter your current password.';
    if (form.newPassword.length < 8) next.newPassword = 'At least 8 characters.';
    else if (!/[A-Za-z]/.test(form.newPassword)) next.newPassword = 'Include at least one letter.';
    else if (!/\d/.test(form.newPassword)) next.newPassword = 'Include at least one number.';
    if (form.confirmPassword !== form.newPassword)
      next.confirmPassword = 'The two passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated.');
    } catch (error) {
      setErrors(error.fieldErrors || {});
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Change your password"
        subtitle="At least 8 characters, including a letter and a number."
      />
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Current password" error={errors.currentPassword} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={update('currentPassword')}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="New password" error={errors.newPassword} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={update('newPassword')}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Confirm new password" error={errors.confirmPassword} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Button type="submit" loading={saving}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
