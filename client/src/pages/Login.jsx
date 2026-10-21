import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { UnderlineField, UnderlineInput, Button } from '../components/ui/index.js';
import AuthIcon from '../components/ui/AuthIcon.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

export default function Login() {
  useDocumentTitle('Sign in');
  const { signIn, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => clearSessionMessage(), [clearSessionMessage]);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /** Client-side checks mirror the server rules so the user is told early. */
  const validate = () => {
    const next = {};
    if (!form.email.trim()) next.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'That does not look like an email address.';
    if (!form.password) next.password = 'Enter your password.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signIn({ email: form.email.trim(), password: form.password });
      navigate(location.state?.from || '/app', { replace: true });
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-center text-3xl font-extrabold tracking-tight text-brand-700">LOGIN</h2>

      {sessionMessage && (
        <p className="mt-6 rounded-xl border border-caution/40 bg-caution/10 px-4 py-3 text-sm text-caution">
          {sessionMessage}
        </p>
      )}

      <form className="mt-10 space-y-7" onSubmit={onSubmit} noValidate>
        {formError && (
          <p
            role="alert"
            className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative"
          >
            {formError}
          </p>
        )}

        <UnderlineField label="Email address" error={errors.email} icon={<AuthIcon name="at" />}>
          {({ id, describedBy, invalid }) => (
            <UnderlineInput
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="username"
              value={form.email}
              onChange={update('email')}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </UnderlineField>

        <UnderlineField label="Password" error={errors.password} icon={<AuthIcon name="lock" />}>
          {({ id, describedBy, invalid }) => (
            <UnderlineInput
              id={id}
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="password"
              value={form.password}
              onChange={update('password')}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </UnderlineField>

        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Forgot password?{' '}
          <span className="font-normal normal-case tracking-normal text-ink-faint">
            Ask an admin to reset it - email delivery is not set up.
          </span>
        </p>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          className="!rounded-full uppercase tracking-wide"
        >
          Log in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
