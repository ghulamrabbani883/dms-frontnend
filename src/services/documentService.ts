import { z } from 'zod'
import {
  documentSchema,
  tagRequestSchema,
  uploadSchema,
  type StoredDocument,
  type UploadInput,
} from '../types/documents'
import type { SearchFiltersState } from '../types/search'
import { indexedDb } from '../storage/indexedDb'
import { cacheSearchResults, getCachedSearchResults } from '../storage/searchCache'
import { API_BASE_URL, apiCall, authenticatedHeaders, getApiToken, getApiUserId } from './api'

const searchFiltersSchema = z.object({
  category: z.string(),
  minorHead: z.string(),
  search: z.string(),
  from: z.string(),
  to: z.string(),
}) satisfies z.ZodType<SearchFiltersState>
const rawRecordSchema = z.record(z.string(), z.unknown())

const stringField = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

const numberField = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return 0
}

const normalizeDate = (value: string) => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? '' : parsed.toISOString().slice(0, 10)
}

const findRecords = (value: unknown, depth = 0): Record<string, unknown>[] | null => {
  if (depth > 3) return null
  if (Array.isArray(value)) {
    const parsed = z.array(rawRecordSchema).safeParse(value)
    if (parsed.success) return parsed.data
    return null
  }
  const parsed = rawRecordSchema.safeParse(value)
  if (!parsed.success) return null
  for (const key of ['data', 'results', 'records', 'aaData', 'result', 'documents']) {
    const records = findRecords(parsed.data[key], depth + 1)
    if (records) return records
  }
  return null
}

const tagNames = (value: unknown): string[] => {
  if (typeof value === 'string') return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = rawRecordSchema.safeParse(item)
    if (!parsed.success) return typeof item === 'string' ? [item] : []
    const tag = stringField(parsed.data, ['tag_name', 'name', 'tag', 'label'])
    return tag ? [tag] : []
  })
}

const normalizeDocument = (raw: Record<string, unknown>, index: number): StoredDocument => {
  const fileUrl = stringField(raw, ['file_url', 'document_url', 'download_url', 'file_path', 'path'])
  const pathName = fileUrl.split(/[?#]/, 1)[0]?.split('/').pop() ?? ''
  let decodedPathName = pathName
  try {
    decodedPathName = decodeURIComponent(pathName)
  } catch (error) {
    console.warn('Could not decode a document filename from its URL.', error)
  }
  const name = stringField(raw, ['name', 'file_name', 'document_name', 'original_file_name', 'filename'])
    || decodedPathName
    || `Document ${index + 1}`
  const date = normalizeDate(stringField(raw, ['date', 'document_date', 'uploaded_at', 'upload_time', 'created_at', 'created_date']))
  const extension = name.toLowerCase().split('.').pop()
  const inferredMimeType = extension === 'pdf' ? 'application/pdf'
    : extension === 'png' ? 'image/png'
      : extension === 'gif' ? 'image/gif'
        : extension === 'webp' ? 'image/webp'
          : ['jpg', 'jpeg'].includes(extension ?? '') ? 'image/jpeg'
            : 'application/octet-stream'
  const mimeType = stringField(raw, ['mime_type', 'content_type', 'file_type']) || inferredMimeType
  return {
    ...documentSchema.parse({
      id: stringField(raw, ['id', 'document_id', 'document_entry_id', 'entry_id']) || `api-${index}`,
      name,
      category: stringField(raw, ['major_head', 'category']) || 'Professional',
      minorHead: stringField(raw, ['minor_head', 'department', 'person']) || 'Uncategorized',
      date,
      size: numberField(raw, ['size', 'file_size', 'document_size']),
      mimeType,
      tags: tagNames(raw.tags),
      remarks: stringField(raw, ['document_remarks', 'remarks']),
    }),
    ...(fileUrl ? { fileUrl } : {}),
  }
}

const toApiDate = (date: string) => {
  if (!date) return ''
  const parsed = z.string().date().parse(date)
  const [year, month, day] = parsed.split('-')
  return `${day}-${month}-${year}`
}

const waitForMockRequest = async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 220))
  if (!navigator.onLine) throw new Error('You are offline. Your changes were rolled back.')
}

export const documentService = {
  async list(filters: SearchFiltersState): Promise<StoredDocument[]> {
    const validatedFilters = searchFiltersSchema.parse(filters)
    if (getApiToken()) {
      try {
        const response = await apiCall(`${API_BASE_URL}/searchDocumentEntry`, {
          method: 'POST',
          headers: authenticatedHeaders(),
          body: {
            major_head: validatedFilters.category,
            minor_head: validatedFilters.minorHead,
            from_date: toApiDate(validatedFilters.from),
            to_date: toApiDate(validatedFilters.to),
            tags: validatedFilters.search
              .split(/[,\s]+/)
              .filter(Boolean)
              .map((tag_name) => ({ tag_name })),
            uploaded_by: '',
            start: 0,
            length: 1000,
            filterId: '',
            search: { value: validatedFilters.search },
          },
        })
        const records = findRecords(response)
        if (!records) throw new Error('The document search response did not contain a valid results list.')
        const normalized = records.map(normalizeDocument)
        cacheSearchResults(normalized)
        return normalized
      } catch (error) {
        if (!navigator.onLine) {
          const cached = getCachedSearchResults()
          if (cached) return cached
        }
        throw error
      }
    }

    try {
      return await indexedDb.listDocuments()
    } catch (error) {
      if (!navigator.onLine) {
        const cached = getCachedSearchResults()
        if (cached) return cached
      }
      throw error
    }
  },

  async add(input: UploadInput): Promise<StoredDocument> {
    const validated = uploadSchema.parse(input)
    if (getApiToken()) {
      const formData = new FormData()
      formData.append('file', validated.file, validated.file.name)
      formData.append('data', JSON.stringify({
        major_head: validated.category,
        minor_head: validated.minorHead,
        document_date: toApiDate(validated.date),
        document_remarks: validated.remarks,
        tags: validated.tags.map((tag_name) => ({ tag_name })),
        user_id: getApiUserId() ?? 'nitin',
      }))
      const response = await apiCall(`${API_BASE_URL}/saveDocumentEntry`, {
        method: 'POST',
        headers: authenticatedHeaders(),
        body: formData,
      })
      const raw = rawRecordSchema.safeParse(response)
      if (!raw.success && response !== undefined) {
        throw new Error('The upload response was not a valid JSON object.')
      }
      const responseData = raw.success ? rawRecordSchema.safeParse(raw.data) : null
      const result = responseData?.success ? responseData.data : raw.success ? raw.data : {}
      const responseId = stringField(result, ['id', 'document_id', 'document_entry_id'])
      const record = documentSchema.parse({
        id: responseId || crypto.randomUUID(),
        name: validated.file.name,
        category: validated.category,
        minorHead: validated.minorHead,
        date: validated.date,
        size: validated.file.size,
        mimeType: validated.file.type,
        tags: validated.tags,
        remarks: validated.remarks,
      })
      return { ...record, fileBlob: validated.file }
    }
    await waitForMockRequest()
    const record = documentSchema.parse({
      id: crypto.randomUUID(),
      name: validated.file.name,
      category: validated.category,
      minorHead: validated.minorHead,
      date: validated.date,
      size: validated.file.size,
      mimeType: validated.file.type,
      tags: validated.tags,
      remarks: validated.remarks,
    })
    const stored: StoredDocument = { ...record, fileBlob: validated.file }
    await indexedDb.saveDocument(stored)
    return stored
  },

  async addTag(id: string, tag: string): Promise<void> {
    const validated = tagRequestSchema.parse({ id, tag })
    if (getApiToken()) {
      throw new Error('The provided API collection does not include a request for adding a tag by document.')
    }
    await waitForMockRequest()
    const current = await indexedDb.getDocument(validated.id)
    if (!current) throw new Error('Document no longer exists.')
    await indexedDb.saveDocument({
      ...current,
      tags: [...new Set([...current.tags, validated.tag])],
    })
  },

  async remove(id: string): Promise<void> {
    const validatedId = documentSchema.shape.id.parse(id)
    if (getApiToken()) {
      throw new Error('The provided API collection does not include a document deletion request.')
    }
    await waitForMockRequest()
    await indexedDb.deleteDocument(validatedId)
  },

  async getFile(document: StoredDocument): Promise<Blob> {
    if (document.fileBlob) return document.fileBlob
    if (!document.fileUrl) {
      if (getApiToken()) {
        throw new Error('The API search response did not include a file URL for this document.')
      }
      return new Blob(
        [`Elevate demo document: ${document.name}\n\nThis is sample content for the local demo.`],
        { type: document.mimeType },
      )
    }
    const url = /^https?:\/\//i.test(document.fileUrl)
      ? document.fileUrl
      : new URL(document.fileUrl.replace(/^\/+/, ''), `${API_BASE_URL}/`).toString()
    const response = await fetch(url, { headers: authenticatedHeaders() })
    if (!response.ok) throw new Error(`Could not download the document (HTTP ${response.status}).`)
    return response.blob()
  },
}
