import { memo } from 'react'
import type { SearchFiltersState } from '../../types/search'
import TagInput from '../common/TagInput'

type SearchFiltersProps = {
  filters: SearchFiltersState
  categories: string[]
  minorHeads: string[]
  onChange: (filters: SearchFiltersState) => void
  onClear: () => void
}

const SearchFilters = memo(({
  filters,
  categories,
  minorHeads,
  onChange,
  onClear,
}: SearchFiltersProps) => (
  <div className="filter-bar">
    <label className="filter-select">
      <span className="sr-only">Category</span>
      <select
        aria-label="Category"
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
        aria-label="Person or department"
        value={filters.minorHead}
        onChange={(event) => onChange({ ...filters, minorHead: event.target.value })}
      >
        <option value="">All people or departments</option>
        {minorHeads.map((head) => <option key={head}>{head}</option>)}
      </select>
    </label>
    <label className="search-tags">
      <span>Tags</span>
      <TagInput
        tags={filters.tags}
        onChange={(tags) => onChange({ ...filters, tags })}
        inputLabel="Filter by tags"
        placeholder={filters.tags.length ? 'Add another…' : 'Add tags…'}
        fetchOnMount
      />
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
      disabled={!filters.category && !filters.minorHead && !filters.tags.length && !filters.from && !filters.to}
    >
      Clear
    </button>
  </div>
))

SearchFilters.displayName = 'SearchFilters'
export default SearchFilters
