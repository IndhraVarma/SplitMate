import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../layouts/PageHeader.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { useToast } from '../context/ToastContext.jsx';
import * as groupService from '../services/group.service.js';
import { Button, Card, Field, TextInput, Spinner } from '../components/ui/index.js';

/**
 * Redeems a group invitation token.
 *
 * The token can arrive in the URL (from a shared link) or be pasted in. The API
 * checks that the signed-in account's email matches the invited address, so a
 * forwarded link cannot be used by the wrong person.
 */
export default function JoinGroup() {
  useDocumentTitle('Join a group');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [token, setToken] = useState(params.get('token') || '');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(params.get('token') ? 'joining' : 'idle');

  const join = async (value) => {
    setStatus('joining');
    setError(null);
    try {
      const { data } = await groupService.acceptInvitation(value.trim());
      toast.success(`You have joined ${data.group?.name || 'the group'}.`);
      navigate(data.group ? `/app/groups/${data.group.id}` : '/app/groups', { replace: true });
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  // Auto-redeem when the token came in through the link.
  useEffect(() => {
    const fromUrl = params.get('token');
    if (fromUrl) join(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'joining') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-accent">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-ink-muted">Checking your invitation...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Join a group"
        subtitle="Paste the invite code you were given."
        backTo="/app/groups"
      />
      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (token.trim().length < 10) {
              setError('That invite code does not look right.');
              return;
            }
            join(token);
          }}
          noValidate
          className="space-y-4"
        >
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative"
            >
              {error}
            </p>
          )}

          <Field label="Invite code" required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError(null);
                }}
                describedBy={describedBy}
                invalid={invalid}
                placeholder="Paste the code here"
                autoFocus
              />
            )}
          </Field>

          <Button type="submit" size="lg" fullWidth>
            Join group
          </Button>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          An invitation only works for the email address it was sent to. If this one is not for your
          account, ask the group admin to invite {''}
          your address instead.
        </p>
      </Card>
    </>
  );
}
