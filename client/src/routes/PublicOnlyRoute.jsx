import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/** Keeps a signed-in user away from the sign-in and sign-up screens. */
export default function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-accent">
        <Spinner size="lg" />
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/app" replace /> : <Outlet />;
}
