import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, userEvent } from './testUtils.jsx';
import GroupExpenseForm from '../pages/GroupExpenseForm.jsx';

const createExpense = vi.fn();
const navigate = vi.fn();
const reloadGroup = vi.fn();

const MEMBERS = [
  { userId: 'aaa111', name: 'Alice', email: 'alice@example.com', avatarColor: '#10b981', status: 'active' },
  { userId: 'bbb222', name: 'Bob', email: 'bob@example.com', avatarColor: '#0ea5e9', status: 'active' },
  { userId: 'ccc333', name: 'Cara', email: 'cara@example.com', avatarColor: '#8b5cf6', status: 'active' },
];

vi.mock('../layouts/GroupLayout.jsx', () => ({
  useGroup: () => ({
    groupId: 'g1',
    activeMembers: MEMBERS,
    currentUserId: 'aaa111',
    reloadGroup,
  }),
}));

vi.mock('../services/group.service.js', () => ({
  createExpense: (...args) => createExpense(...args),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  getExpense: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => ({ groupId: 'g1' }),
  };
});

const amountInput = () => screen.getByLabelText(/total amount/i);

describe('shared expense form - live split preview', () => {
  beforeEach(() => {
    createExpense.mockReset();
    navigate.mockReset();
    createExpense.mockResolvedValue({ data: { expense: { id: 'e1' } } });
  });

  it('starts with everyone selected', () => {
    renderWithProviders(<GroupExpenseForm />);
    for (const member of MEMBERS) {
      expect(screen.getByLabelText(new RegExp(`^${member.name === 'Alice' ? 'You' : member.name}$`))).toBeChecked();
    }
  });

  it('previews an equal split that divides cleanly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.type(amountInput(), '3000');

    await waitFor(() => expect(screen.getAllByText('₹1,000.00')).toHaveLength(3));
    expect(screen.getByText(/₹3,000\.00 of ₹3,000\.00/)).toBeInTheDocument();
  });

  it('shows exactly where the indivisible paise goes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    // Rs 10 across three people: 3.34 / 3.33 / 3.33.
    await user.type(amountInput(), '10');

    await waitFor(() => expect(screen.getByText('₹3.34')).toBeInTheDocument());
    expect(screen.getAllByText('₹3.33')).toHaveLength(2);
    // The reconciliation line proves nothing was lost.
    expect(screen.getByText(/₹10\.00 of ₹10\.00/)).toBeInTheDocument();
  });

  it('recalculates when someone is removed from the split', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.type(amountInput(), '3000');
    await waitFor(() => expect(screen.getAllByText('₹1,000.00')).toHaveLength(3));

    await user.click(screen.getByLabelText('Cara'));

    await waitFor(() => expect(screen.getAllByText('₹1,500.00')).toHaveLength(2));
  });

  it('flags a percentage split that does not reach 100%', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.type(amountInput(), '1000');
    await user.click(screen.getByRole('tab', { name: /percentages/i }));

    await user.type(screen.getByLabelText(/percentage for Alice/i), '50');
    await user.type(screen.getByLabelText(/percentage for Bob/i), '30');
    await user.type(screen.getByLabelText(/percentage for Cara/i), '10');

    expect(await screen.findByText(/add up to 100%/i)).toBeInTheDocument();
    expect(screen.getByText(/does not add up/i)).toBeInTheDocument();
  });

  it('accepts a percentage split that totals 100%', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.type(amountInput(), '1000');
    await user.click(screen.getByRole('tab', { name: /percentages/i }));

    await user.type(screen.getByLabelText(/percentage for Alice/i), '50');
    await user.type(screen.getByLabelText(/percentage for Bob/i), '30');
    await user.type(screen.getByLabelText(/percentage for Cara/i), '20');

    await waitFor(() =>
      expect(screen.getByText(/₹1,000\.00 of ₹1,000\.00/)).toBeInTheDocument()
    );
    expect(screen.getByText('₹500.00')).toBeInTheDocument();
    expect(screen.getByText('₹300.00')).toBeInTheDocument();
    expect(screen.getByText('₹200.00')).toBeInTheDocument();
  });

  it('flags exact amounts that miss the total', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.type(amountInput(), '1000');
    await user.click(screen.getByRole('tab', { name: /exact amounts/i }));

    await user.type(screen.getByLabelText(/amount for Alice/i), '500');
    await user.type(screen.getByLabelText(/amount for Bob/i), '300');
    await user.type(screen.getByLabelText(/amount for Cara/i), '100');

    expect(await screen.findByText(/does not add up/i)).toBeInTheDocument();
  });

  it('refuses to submit when the allocation does not reconcile', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.type(screen.getByLabelText(/what was it for/i), 'Dinner');
    await user.type(amountInput(), '1000');
    await user.click(screen.getByRole('tab', { name: /exact amounts/i }));
    await user.type(screen.getByLabelText(/amount for Alice/i), '500');
    await user.type(screen.getByLabelText(/amount for Bob/i), '300');
    await user.type(screen.getByLabelText(/amount for Cara/i), '100');

    await user.click(screen.getByRole('button', { name: /add expense/i }));

    await waitFor(() => expect(createExpense).not.toHaveBeenCalled());
  });

  it('submits a valid equal split', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.type(screen.getByLabelText(/what was it for/i), 'Seafood dinner');
    await user.type(amountInput(), '3000');
    await user.click(screen.getByRole('button', { name: /add expense/i }));

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1));
    const [groupId, payload] = createExpense.mock.calls[0];
    expect(groupId).toBe('g1');
    expect(payload).toMatchObject({
      description: 'Seafood dinner',
      amount: '3000',
      splitType: 'EQUAL',
      paidBy: 'aaa111',
    });
    expect(payload.participants).toHaveLength(3);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/groups/g1'));
  });

  it('requires a description and an amount', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.click(screen.getByRole('button', { name: /add expense/i }));

    expect(await screen.findByText(/say what this expense was for/i)).toBeInTheDocument();
    expect(screen.getByText(/enter a valid amount/i)).toBeInTheDocument();
    expect(createExpense).not.toHaveBeenCalled();
  });

  it('will not submit with nobody selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupExpenseForm />);

    await user.type(screen.getByLabelText(/what was it for/i), 'Dinner');
    await user.type(amountInput(), '1000');
    await user.click(screen.getByRole('button', { name: /clear all/i }));
    await user.click(screen.getByRole('button', { name: /add expense/i }));

    expect(await screen.findByText(/pick at least one person/i)).toBeInTheDocument();
    expect(createExpense).not.toHaveBeenCalled();
  });
});
