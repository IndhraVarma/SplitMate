import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/**
 * Gate for every signed-in screen.
 *
 * While the session is being restored we show a spinner rather than briefly
 * redirecting to sign-in, which would otherwise flash on every reload. The
 * attempted path is remembered so the user lands where they meant to go.
 *
 * This is a convenience, not a security boundary - the API authorises every
 * request independently.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-accent">
        <Spinner size="lg" label="Checking your session" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
