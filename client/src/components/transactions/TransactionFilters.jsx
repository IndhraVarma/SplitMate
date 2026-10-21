import { Select, TextInput, Button } from '../ui/index.js';
import NavIcon from '../NavIcon.jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../utils/constants.js';
import { titleCase } from '../../utils/format.js';

const ALL_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])].sort();

/**
 * Search + filters for the activity screen. Stacks vertically on a phone so no
 * horizontal scrolling is ever needed.
 */
export default function TransactionFilters({ filters, onChange, onReset }) {
  const set = (field) => (event) => onChange({ ...filters, [field]: event.target.value, page: 1 });
  const hasFilters = Boolean(
    filters.search || filters.type || filters.category || filters.from || filters.to
  );

  return (
    <div className="card space-y-3 p-4">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
          <NavIcon name="search" className="h-4 w-4" />
        </span>
        <TextInput
          type="search"
          className="pl-10"
          placeholder="Search descriptions and notes"
          aria-label="Search transactions"
          value={filters.search || ''}
          onChange={set('search')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label text-xs" htmlFor="filter-type">Type</label>
          <Select id="filter-type" value={filters.type || ''} onChange={set('type')}>
            <option value="">All</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </Select>
        </div>

        <div>
          <label className="label text-xs" htmlFor="filter-category">Category</label>
          <Select id="filter-category" value={filters.category || ''} onChange={set('category')}>
            <option value="">All</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{titleCase(c)}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="label text-xs" htmlFor="filter-from">From</label>
          <TextInput id="filter-from" type="date" value={filters.from || ''} onChange={set('from')} />
        </div>

        <div>
          <label className="label text-xs" htmlFor="filter-to">To</label>
          <TextInput id="filter-to" type="date" value={filters.to || ''} onChange={set('to')} />
        </div>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
