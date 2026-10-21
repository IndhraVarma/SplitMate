import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import AppRoutes from './routes/index.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      {/* Opt in to v7 behaviour now so the upgrade is a no-op later. */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
