import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Button from '../components/ui/Button.jsx';
import NavIcon from '../components/NavIcon.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  {
    icon: 'transactions',
    title: 'Track every rupee',
    body: 'Log income and spending, tag it, and see where the month actually went. Amounts are stored in whole paise, so nothing drifts.',
  },
  {
    icon: 'groups',
    title: 'Split without arguments',
    body: 'Share a bill equally, by exact amounts, or by percentage. Allocations always reconcile to the total, to the paise.',
  },
  {
    icon: 'balance',
    title: 'Know who owes whom',
    body: 'Live balances per group, plus a simplified set of repayments so four people settle up in two transfers, not six.',
  },
  {
    icon: 'budgets',
    title: 'Budgets that tell the truth',
    body: 'Set a monthly cap per category and watch the real number against it. No projections, no guesswork.',
  },
];

export default function Landing() {
  useDocumentTitle('Track spending and split bills');
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-surface-raised">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo to={null} />
        <nav className="flex items-center gap-2">
          {isAuthenticated ? (
            <Button to="/app" size="sm" className="!rounded-full">
              Open SplitMate
            </Button>
          ) : (
            <>
              <Button to="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button to="/register" size="sm" className="!rounded-full">
                Get started
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero sits on the same pale sage as the sign-in screens. */}
        <section className="bg-surface-auth">
          <div className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:pt-20">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-surface-raised px-3 py-1 text-xs font-semibold text-brand-700">
                Personal ledger + group splitter
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-brand-800 sm:text-5xl">
                Split bills, pay easy.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-ink-muted">
                SplitMate keeps your personal spending and your shared expenses in one place - and
                settles the awkward question of who owes whom, down to the last paise.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  to={isAuthenticated ? '/app' : '/register'}
                  size="lg"
                  className="!rounded-full uppercase tracking-wide"
                >
                  {isAuthenticated ? 'Open SplitMate' : 'Create a free account'}
                </Button>
                <Button to="/login" variant="secondary" size="lg" className="!rounded-full">
                  I already have an account
                </Button>
              </div>
              <p className="mt-4 text-xs text-ink-muted">
                No bank connection, no payments. SplitMate records what is owed - you move the money
                however you already do.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-brand-700">
                <NavIcon name={feature.icon} className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-ink">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="tile-accent flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold">Ready to stop doing mental arithmetic?</h2>
              <p className="mt-1.5 text-sm text-ink-onAccent/85">
                Set up an account in under a minute. Your data stays yours.
              </p>
            </div>
            <Button
              to={isAuthenticated ? '/app' : '/register'}
              size="lg"
              className="!rounded-full bg-surface-raised !text-brand-700 hover:bg-brand-50"
            >
              {isAuthenticated ? 'Open SplitMate' : 'Get started'}
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-surface-border px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-ink-faint sm:flex-row">
          <span>SplitMate - a portfolio project. All demo data is fictional.</span>
          <Link to="/login" className="hover:text-brand-700">
            Log in
          </Link>
        </div>
      </footer>
    </div>
  );
}
