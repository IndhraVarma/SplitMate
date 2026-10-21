import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from './testUtils.jsx';
import Login from '../pages/Login.jsx';

const signIn = vi.fn();
const navigate = vi.fn();

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    signIn,
    sessionMessage: null,
    clearSessionMessage: () => {},
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ pathname: '/login', state: null }),
  };
});

describe('sign-in form', () => {
  beforeEach(() => {
    signIn.mockReset();
    navigate.mockReset();
  });

  it('shows the fields a user needs', () => {
    renderWithProviders(<Login />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('refuses to submit an empty form and says why', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects an address that is not an email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(/does not look like an email/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('submits trimmed credentials and navigates on success', async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValue({ id: 'u1' });
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email address/i), '  asha@example.com  ');
    await user.type(screen.getByLabelText(/password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: 'asha@example.com',
        password: 'Password123',
      })
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', { replace: true }));
  });

  it('shows the error the server returned and stays on the form', async () => {
    const user = userEvent.setup();
    const error = new Error('Email or password is incorrect.');
    error.fieldErrors = {};
    signIn.mockRejectedValue(error);

    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/email address/i), 'asha@example.com');
    await user.type(screen.getByLabelText(/password/i), 'WrongPassword1');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect/i);
    expect(navigate).not.toHaveBeenCalled();
  });
});
