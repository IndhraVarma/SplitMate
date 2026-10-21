import { Link, Outlet } from 'react-router-dom';
import Logo from '../components/Logo.jsx';

/**
 * The signed-out shell.
 *
 * A single pale sage canvas with the stacked wordmark at the top and the form
 * centred beneath it - deliberately uncluttered, because the only two things a
 * visitor can do here are sign in or sign up.
 */
export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-auth">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-12 sm:pt-16">
        <Logo to={null} variant="stacked" />

        <main className="flex flex-1 flex-col justify-center py-10">
          <Outlet />
        </main>

        <footer className="text-center text-xs text-brand-700/70">
          <Link to="/" className="hover:text-brand-700">
            Back to the home page
          </Link>
        </footer>
      </div>
    </div>
  );
}
