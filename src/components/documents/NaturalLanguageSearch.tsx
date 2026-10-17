import { useState, type FormEvent } from 'react'
import * as chrono from 'chrono-node'
import { categories } from '../../types/documents'
import { initialSearchFilters, type SearchFiltersState } from '../../types/search'

type NaturalLanguageSearchProps = {
  onApply: (filters: SearchFiltersState) => void
}

type SearchEntity = {
  category: string
  minorHead: string
  aliases: string[]
}

const entities: SearchEntity[] = [
  ...categories.Professional.map((minorHead): SearchEntity => ({
    category: 'Professional',
    minorHead,
    aliases: minorHead === 'Human Resources'
      ? ['human resources', 'human resource', 'hr']
      : minorHead === 'Information Technology'
        ? ['information technology', 'it']
        : [minorHead],
  })),
  ...categories.Personal.map((minorHead): SearchEntity => ({
    category: 'Personal',
    minorHead,
    aliases: [minorHead],
  })),
]

const hasPhrase = (text: string, phrase: string) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text)
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateRangeFromPhrase = (text: string): Pick<SearchFiltersState, 'from' | 'to'> | null => {
  const parsedDates = chrono.parse(text, new Date(), { forwardDate: false })
  const firstDate = parsedDates[0]
  if (!firstDate) return null

  const lastDate = parsedDates[parsedDates.length - 1]
  if (parsedDates.length > 1 && lastDate) {
    return {
      from: toIsoDate(firstDate.start.date()),
      to: toIsoDate(lastDate.end?.date() ?? lastDate.start.date()),
    }
  }

  const date = firstDate.start.date()
  const normalized = firstDate.text.toLowerCase()
  if (/\b(last|previous)\s+week\b/.test(normalized)) {
    const end = new Date(date)
    end.setDate(end.getDate() + 6)
    return { from: toIsoDate(date), to: toIsoDate(end) }
  }
  if (/\b(this|current)\s+week\b/.test(normalized)) {
    const end = new Date(date)
    end.setDate(end.getDate() + 6)
    const today = new Date()
    return { from: toIsoDate(date), to: toIsoDate(end < today ? end : today) }
  }
  if (/\b(last|previous)\s+month\b/.test(normalized)) {
    return {
      from: toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1)),
      to: toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    }
  }
  if (/\b(this|current)\s+month\b/.test(normalized)) {
    return {
      from: toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1)),
      to: toIsoDate(new Date()),
    }
  }
  return {
    from: toIsoDate(date),
    to: toIsoDate(firstDate.end?.date() ?? date),
  }
}

const tagsFromPhrase = (text: string) => {
  const match = /(?:tagged|tags?|labelled|labeled)\s+(?:with\s+)?(.+?)(?=\s+(?:from|between|uploaded|created|dated|after|before|last|this|on|in)\b|$)/i.exec(text)
  if (!match?.[1]) return []
  return [...new Set(match[1]
    .split(/\s*(?:,| and )\s*/i)
    .map((tag) => tag.replace(/^["'#\s]+|["'\s.]+$/g, '').trim())
    .filter((tag) => /^[\p{L}\p{N}_-]{1,100}$/u.test(tag)))]
}

const parseSearchPhrase = (input: string): SearchFiltersState | null => {
  const text = input.trim()
  if (!text) return null

  const filters: SearchFiltersState = {
    ...initialSearchFilters,
    tags: tagsFromPhrase(text),
  }

  const category = ['Personal', 'Professional'].find((name) => hasPhrase(text, name))
  if (category) filters.category = category

  const entity = entities
    .flatMap((item) => item.aliases.map((alias) => ({ item, alias })))
    .sort((first, second) => second.alias.length - first.alias.length)
    .find(({ alias }) => hasPhrase(text, alias))
  if (entity) {
    filters.category = entity.item.category
    filters.minorHead = entity.item.minorHead
  }

  const dateRange = dateRangeFromPhrase(text)
  if (dateRange) {
    filters.from = dateRange.from
    filters.to = dateRange.to
  }

  return filters.category || filters.minorHead || filters.tags.length || filters.from || filters.to
    ? filters
    : null
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
    const filters = parseSearchPhrase(query)
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
