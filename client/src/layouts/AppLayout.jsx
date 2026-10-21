import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';
import NavIcon from '../components/NavIcon.jsx';
import Avatar from '../components/ui/Avatar.jsx';

/**
 * The signed-in shell.
 *
 * Phones get a compact bar with a hamburger and the screen title, and a
 * slide-in drawer for navigation. From `lg` up the drawer becomes a permanent
 * sidebar and the hamburger disappears. The main column is capped so lines stay
 * readable on very wide screens.
 */
const NAV = [
  { to: '/app', label: 'Home', icon: 'dashboard', end: true },
  { to: '/app/transactions', label: 'Recent Activity', icon: 'transactions' },
  { to: '/app/budgets', label: 'Budgets', icon: 'budgets' },
  { to: '/app/groups', label: 'Groups', icon: 'groups' },
  { to: '/app/profile', label: 'Profile', icon: 'profile' },
];

/** The title shown in the mobile bar, derived from the current route. */
function titleForPath(pathname) {
  if (pathname === '/app') return 'Home';
  if (pathname.startsWith('/app/transactions')) return 'Recent Activity';
  if (pathname.startsWith('/app/budgets')) return 'Budgets';
  if (pathname.startsWith('/app/groups')) return 'Groups';
  if (pathname.startsWith('/app/profile')) return 'Profile';
  return 'SplitMate';
}

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const triggerRef = useRef(null);

  // Any navigation closes the drawer.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Escape closes it, focus moves in and back out, background scroll is locked.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => drawerRef.current?.querySelector('a')?.focus(), 40);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      clearTimeout(timer);
      triggerRef.current?.focus();
    };
  }, [drawerOpen]);

  const navList = (
    <nav className="flex-1 space-y-1" aria-label="Main">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-accent text-ink-onAccent'
                : 'text-ink-muted hover:bg-surface-overlay hover:text-brand-700'
            }`
          }
        >
          <NavIcon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  const userCard = user && (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-overlay p-3">
      <Avatar name={user.name} color={user.avatarColor} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
        <p className="truncate text-xs text-ink-faint">{user.email}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        aria-label="Sign out"
        className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-raised hover:text-negative"
      >
        <NavIcon name="logout" className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-raised">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-ink-onAccent"
      >
        Skip to content
      </a>

      {/* Permanent sidebar from lg up */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-surface-border bg-surface-base px-4 py-6 lg:flex">
        <div className="px-1">
          <Logo />
        </div>
        <div className="mt-8 flex flex-1 flex-col">{navList}</div>
        {userCard}
      </aside>

      {/* Mobile bar */}
      <header className="sticky top-0 z-20 border-b border-surface-border bg-surface-raised/95 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className="-ml-1 rounded-lg p-1.5 text-brand-600 transition-colors hover:bg-surface-overlay"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </button>
          <h1 className="flex-1 text-lg font-extrabold uppercase tracking-tight text-ink">
            {titleForPath(location.pathname)}
          </h1>
          {user && (
            <NavLink to="/app/profile" aria-label="Your profile">
              <Avatar name={user.name} color={user.avatarColor} size="sm" />
            </NavLink>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-ink/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-72 max-w-[82%] animate-slide-in-left flex-col border-r border-surface-border bg-surface-base px-4 py-6 shadow-lift"
          >
            <div className="flex items-center justify-between px-1">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-2 text-ink-muted hover:bg-surface-overlay"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M6.3 5a.9.9 0 00-1.3 1.3L8.7 10l-3.7 3.7A.9.9 0 106.3 15l3.7-3.7 3.7 3.7a.9.9 0 001.3-1.3L11.3 10 15 6.3A.9.9 0 0013.7 5L10 8.7 6.3 5z" />
                </svg>
              </button>
            </div>
            <div className="mt-8 flex flex-1 flex-col">{navList}</div>
            {userCard}
          </div>
        </div>
      )}

      <main id="main" className="lg:pl-64">
        <div
          key={location.pathname}
          className="mx-auto w-full max-w-5xl animate-fade-in px-4 pb-16 pt-5 sm:px-6"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
