import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { UnderlineField, UnderlineInput, Button } from '../components/ui/index.js';
import AuthIcon from '../components/ui/AuthIcon.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

/** Same rules the API enforces, stated plainly under the field. */
const PASSWORD_HINT = 'At least 8 characters, including a letter and a number.';

export default function Register() {
  useDocumentTitle('Create your account');
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your name (at least 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password)) next.password = 'Include at least one letter.';
    else if (!/\d/.test(form.password)) next.password = 'Include at least one number.';
    if (form.confirmPassword !== form.password)
      next.confirmPassword = 'The two passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/app', { replace: true });
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-center text-3xl font-extrabold tracking-tight text-brand-700">SIGN UP</h2>

      <form className="mt-10 space-y-7" onSubmit={onSubmit} noValidate>
        {formError && (
          <p
            role="alert"
            className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative"
          >
            {formError}
          </p>
        )}

        <UnderlineField label="Your name" error={errors.name} icon={<AuthIcon name="user" />}>
          {({ id, describedBy, invalid }) => (
            <UnderlineInput
              id={id}
              name="name"
              autoComplete="name"
              placeholder="your name"
              value={form.name}
              onChange={update('name')}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </UnderlineField>

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

        <div>
          <UnderlineField label="Password" error={errors.password} icon={<AuthIcon name="lock" />}>
            {({ id, describedBy, invalid }) => (
              <UnderlineInput
                id={id}
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="password"
                value={form.password}
                onChange={update('password')}
                describedBy={describedBy}
                invalid={invalid}
              />
            )}
          </UnderlineField>
          {!errors.password && <p className="mt-1.5 text-xs text-ink-faint">{PASSWORD_HINT}</p>}
        </div>

        <UnderlineField
          label="Confirm password"
          error={errors.confirmPassword}
          icon={<AuthIcon name="lock" />}
        >
          {({ id, describedBy, invalid }) => (
            <UnderlineInput
              id={id}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="confirm password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </UnderlineField>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          className="!rounded-full uppercase tracking-wide"
        >
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Log In
        </Link>
      </p>
    </div>
  );
}
