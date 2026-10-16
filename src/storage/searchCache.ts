import { documentSchema, type DocumentRecord } from '../types/documents'

const cacheKey = 'elevate-recent-search'

export const cacheSearchResults = (documents: DocumentRecord[]) => {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(documents.slice(0, 200)))
  } catch (error) {
    console.warn('Unable to save search results for offline access.', error)
  }
}

export const getCachedSearchResults = (): DocumentRecord[] | null => {
  try {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Cached search results are not a list.')
    return parsed.map((item) => documentSchema.parse(item))
  } catch (error) {
    console.warn('Unable to read cached search results.', error)
    return null
  }
}
