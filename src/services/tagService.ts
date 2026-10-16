import { z } from 'zod'
import { API_BASE_URL, apiCall, authenticatedHeaders, getApiToken } from './api'

const rawRecordSchema = z.record(z.string(), z.unknown())

const tagName = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null
  const record = rawRecordSchema.safeParse(value)
  if (!record.success) return null
  for (const key of ['tag_name', 'name', 'tag', 'label']) {
    const field = record.data[key]
    if (typeof field === 'string' && field.trim()) return field.trim()
  }
  return null
}

const parseTags = (value: unknown): string[] | null => {
  if (Array.isArray(value)) return value.flatMap((item) => {
    const name = tagName(item)
    return name ? [name] : []
  })
  const record = rawRecordSchema.safeParse(value)
  if (!record.success) return null
  for (const key of ['data', 'tags', 'result']) {
    if (Array.isArray(record.data[key])) return parseTags(record.data[key])
  }
  return null
}

export const tagService = {
  async search(term: string): Promise<string[]> {
    const validatedTerm = z.string().max(100).parse(term)
    if (!getApiToken()) return []

    const response = await apiCall(`${API_BASE_URL}/documentTags`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: { term: validatedTerm },
    })
    const tags = parseTags(response)
    if (!tags) throw new Error('The tag search response did not contain a valid tag list.')
    return tags
  },
}
