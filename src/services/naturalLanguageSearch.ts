import * as chrono from 'chrono-node'
import { categories } from '../types/documents'
import type { SearchFiltersState } from '../types/search'

type EntityMatch = {
  category: string
  minorHead: string
  aliases: string[]
}

const entityMatches: EntityMatch[] = [
  ...categories.Professional.map((minorHead): EntityMatch => ({
    category: 'Professional',
    minorHead,
    aliases: minorHead === 'Human Resources'
      ? ['human resources', 'human resource', 'hr']
      : minorHead === 'Information Technology'
        ? ['information technology', 'it']
        : [minorHead],
  })),
  ...categories.Personal.map((minorHead): EntityMatch => ({
    category: 'Personal',
    minorHead,
    aliases: [minorHead],
  })),
]

const containsPhrase = (text: string, phrase: string) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text)
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

const resolveRelativeRange = (text: string, reference: Date): Pick<SearchFiltersState, 'from' | 'to'> | null => {
  const normalized = text.toLowerCase()
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())

  if (/\b(last|previous)\s+week\b/.test(normalized)) {
    const end = startOfWeek(today)
    end.setDate(end.getDate() - 1)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    return { from: toIsoDate(start), to: toIsoDate(end) }
  }
  if (/\b(this|current)\s+week\b/.test(normalized)) {
    return { from: toIsoDate(startOfWeek(today)), to: toIsoDate(today) }
  }
  if (/\b(last|previous)\s+month\b/.test(normalized)) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: toIsoDate(start), to: toIsoDate(end) }
  }
  if (/\b(this|current)\s+month\b/.test(normalized)) {
    return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIsoDate(today) }
  }
  if (/\byesterday\b/.test(normalized)) {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return { from: toIsoDate(yesterday), to: toIsoDate(yesterday) }
  }
  if (/\btoday\b/.test(normalized)) {
    return { from: toIsoDate(today), to: toIsoDate(today) }
  }
  return null
}

const resolveDateRange = (text: string, reference: Date): Pick<SearchFiltersState, 'from' | 'to'> | null => {
  const relativeRange = resolveRelativeRange(text, reference)
  if (relativeRange) return relativeRange

  const parsedDates = chrono.parse(text, reference, { forwardDate: false })
  if (!parsedDates.length) return null

  const firstDate = parsedDates[0]
  const lastDate = parsedDates[parsedDates.length - 1]
  if (!firstDate) return null
  if (parsedDates.length > 1 && lastDate) {
    return {
      from: toIsoDate(firstDate.start.date()),
      to: toIsoDate(lastDate.end?.date() ?? lastDate.start.date()),
    }
  }

  return {
    from: toIsoDate(firstDate.start.date()),
    to: toIsoDate(firstDate.end?.date() ?? firstDate.start.date()),
  }
}

const resolveTags = (text: string): string[] => {
  const match = /(?:tagged|tags?|labelled|labeled)\s+(?:with\s+)?(.+?)(?=\s+(?:from|between|uploaded|created|dated|after|before|last|this|on|in)\b|$)/i.exec(text)
  if (!match?.[1]) return []
  return [...new Set(match[1]
    .split(/\s*(?:,| and )\s*/i)
    .map((tag) => tag.replace(/^["'#\s]+|["'\s.]+$/g, '').trim())
    .filter((tag) => /^[\p{L}\p{N}_-]{1,100}$/u.test(tag)))]
}

export const parseNaturalLanguageSearch = (
  input: string,
  reference = new Date(),
): SearchFiltersState | null => {
  const text = input.trim()
  if (!text) return null

  const filters: SearchFiltersState = {
    category: '',
    minorHead: '',
    tags: resolveTags(text),
    from: '',
    to: '',
  }

  const categoryMatch = ['Personal', 'Professional'].find((category) => containsPhrase(text, category))
  if (categoryMatch) filters.category = categoryMatch

  const matchingEntity = entityMatches
    .flatMap((entity) => entity.aliases.map((alias) => ({ entity, alias })))
    .sort((first, second) => second.alias.length - first.alias.length)
    .find(({ alias }) => containsPhrase(text, alias))
  if (matchingEntity) {
    filters.category = matchingEntity.entity.category
    filters.minorHead = matchingEntity.entity.minorHead
  }

  const dateRange = resolveDateRange(text, reference)
  if (dateRange) {
    filters.from = dateRange.from
    filters.to = dateRange.to
  }

  return filters.category || filters.minorHead || filters.tags.length || filters.from || filters.to
    ? filters
    : null
}
