import { useState, type FormEvent } from 'react'
import { initialSearchFilters, type SearchFiltersState } from '../../types/search'
import { parseNaturalLanguageSearch } from '../../services/naturalLanguageSearch'

type NaturalLanguageSearchProps = {
  onApply: (filters: SearchFiltersState) => void
}

const describeFilters = (filters: SearchFiltersState) => {
  const parts = [
    filters.minorHead || filters.category,
    ...filters.tags.map((tag) => `#${tag}`),
    filters.from && filters.to
      ? filters.from === filters.to ? filters.from : `${filters.from} to ${filters.to}`
      : filters.from || filters.to,
  ].filter(Boolean)
  return `Applied: ${parts.join(' · ')}`
}

const NaturalLanguageSearch = ({ onApply }: NaturalLanguageSearchProps) => {
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (!value.trim()) {
      onApply(initialSearchFilters)
      setMessage('')
      setHasError(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const filters = parseNaturalLanguageSearch(query)
    if (!filters) {
      setMessage('Try a department, person, category, tag, or date phrase. Example: “Find HR files uploaded last week”.')
      setHasError(true)
      return
    }
    onApply(filters)
    setMessage(describeFilters(filters))
    setHasError(false)
  }

  return (
    <form className="natural-search" onSubmit={handleSubmit}>
      <label htmlFor="natural-search-input">Describe the documents you want to find</label>
      <div className="natural-search-controls">
        <input
          id="natural-search-input"
          type="search"
          value={query}
          placeholder="e.g. Find HR files uploaded last week"
          onChange={(event) => handleQueryChange(event.target.value)}
        />
        <button className="button button-primary" type="submit">Search</button>
      </div>
      <p className={hasError ? 'natural-search-message error' : 'natural-search-message'} aria-live="polite">
        {message || 'Try phrases such as “Finance tagged invoice from June 1 to June 30, 2026”.'}
      </p>
    </form>
  )
}

export default NaturalLanguageSearch
