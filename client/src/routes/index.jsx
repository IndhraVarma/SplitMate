import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import PublicOnlyRoute from './PublicOnlyRoute.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import GroupLayout from '../layouts/GroupLayout.jsx';
import Spinner from '../components/ui/Spinner.jsx';

import Landing from '../pages/Landing.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import NotFound from '../pages/NotFound.jsx';

/**
 * Signed-in screens are code-split: the landing and auth pages are what an
 * anonymous visitor loads, and they should not pay for the charts bundle.
 */
const Dashboard = lazy(() => import('../pages/Dashboard.jsx'));
const Transactions = lazy(() => import('../pages/Transactions.jsx'));
const TransactionForm = lazy(() => import('../pages/TransactionForm.jsx'));
const Budgets = lazy(() => import('../pages/Budgets.jsx'));
const Groups = lazy(() => import('../pages/Groups.jsx'));
const GroupCreate = lazy(() => import('../pages/GroupCreate.jsx'));
const GroupExpenses = lazy(() => import('../pages/GroupExpenses.jsx'));
const GroupExpenseForm = lazy(() => import('../pages/GroupExpenseForm.jsx'));
const GroupBalances = lazy(() => import('../pages/GroupBalances.jsx'));
const GroupSettlements = lazy(() => import('../pages/GroupSettlements.jsx'));
const GroupMembers = lazy(() => import('../pages/GroupMembers.jsx'));
const JoinGroup = lazy(() => import('../pages/JoinGroup.jsx'));
const Profile = lazy(() => import('../pages/Profile.jsx'));

function PageFallback() {
  return (
    <div className="flex justify-center py-20 text-accent">
      <Spinner size="lg" label="Loading page" />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />

        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
        </Route>

        {/* Signed in */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />

            <Route path="transactions" element={<Transactions />} />
            <Route path="transactions/new" element={<TransactionForm />} />
            <Route path="transactions/:id/edit" element={<TransactionForm />} />

            <Route path="budgets" element={<Budgets />} />

            <Route path="groups" element={<Groups />} />
            <Route path="groups/new" element={<GroupCreate />} />
            <Route path="groups/join" element={<JoinGroup />} />

            <Route path="groups/:groupId" element={<GroupLayout />}>
              <Route index element={<GroupExpenses />} />
              <Route path="balances" element={<GroupBalances />} />
              <Route path="settlements" element={<GroupSettlements />} />
              <Route path="members" element={<GroupMembers />} />
              <Route path="expenses/new" element={<GroupExpenseForm />} />
              <Route path="expenses/:id/edit" element={<GroupExpenseForm />} />
            </Route>

            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Legacy / convenience redirects */}
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
