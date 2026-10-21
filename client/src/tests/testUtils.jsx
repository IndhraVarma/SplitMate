import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext.jsx';

/**
 * Renders a component inside the providers it expects. Auth is NOT included by
 * default - tests that need a signed-in user mock the auth module instead, so
 * they do not depend on network behaviour.
 */
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
