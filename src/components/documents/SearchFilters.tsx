import { memo, type RefObject } from 'react'
import type { SearchFiltersState } from '../../types/search'

type SearchFiltersProps = {
  filters: SearchFiltersState
  categories: string[]
  minorHeads: string[]
  searchRef: RefObject<HTMLInputElement | null>
  onChange: (filters: SearchFiltersState) => void
  onClear: () => void
}

const SearchFilters = memo(({
  filters,
  categories,
  minorHeads,
  searchRef,
  onChange,
  onClear,
}: SearchFiltersProps) => (
  <div className="filter-bar">
    <label className="search-field">
      <span aria-hidden="true">⌕</span>
      <input
        ref={searchRef}
        aria-label="Search documents or tags"
        placeholder="Search documents or tags…"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
      />
      <kbd>⌘ K</kbd>
    </label>
    <label className="filter-select">
      <span className="sr-only">Category</span>
      <select
        value={filters.category}
        onChange={(event) => onChange({ ...filters, category: event.target.value, minorHead: '' })}
      >
        <option value="">All categories</option>
        {categories.map((category) => <option key={category}>{category}</option>)}
      </select>
    </label>
    <label className="filter-select">
      <span className="sr-only">Person or department</span>
      <select
        value={filters.minorHead}
        onChange={(event) => onChange({ ...filters, minorHead: event.target.value })}
      >
        <option value="">All departments</option>
        {minorHeads.map((head) => <option key={head}>{head}</option>)}
      </select>
    </label>
    <label className="date-filter">
      <span>From</span>
      <input
        aria-label="From date"
        type="date"
        value={filters.from}
        onChange={(event) => onChange({ ...filters, from: event.target.value })}
      />
    </label>
    <label className="date-filter">
      <span>To</span>
      <input
        aria-label="To date"
        type="date"
        value={filters.to}
        onChange={(event) => onChange({ ...filters, to: event.target.value })}
      />
    </label>
    <button
      className="clear-filters"
      type="button"
      onClick={onClear}
      disabled={Object.values(filters).every((value) => !value)}
    >
      Clear
    </button>
  </div>
))

SearchFilters.displayName = 'SearchFilters'
export default SearchFilters
