import { Button } from '../components/ui/index.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function NotFound() {
  useDocumentTitle('Page not found');
  const { isAuthenticated } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-bold text-accent">404</p>
      <h1 className="mt-4 text-2xl font-bold text-ink">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        The link may be out of date, or the page may have moved.
      </p>
      <Button to={isAuthenticated ? '/app' : '/'} size="lg" className="mt-7">
        {isAuthenticated ? 'Back to your dashboard' : 'Back to the home page'}
      </Button>
    </div>
  );
}
