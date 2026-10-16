import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import UploadForm from './components/documents/UploadForm'
import UserRegistration from './components/administration/UserRegistration'
import Login from './components/login/Login'
import Layout from './components/layout/Layout'
import type { WorkspacePage } from './components/layout/Sidebar'
import { documentService } from './services/documentService'
import { cacheSearchResults, clearCachedSearchResults, getCachedSearchResults } from './storage/searchCache'
import { type StoredDocument, type UploadInput } from './types/documents'
import { initialSearchFilters, type SearchFiltersState } from './types/search'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { clearApiToken, getApiToken } from './services/api'
import SearchFilters from './components/documents/SearchFilters'
import DocumentList from './components/documents/DocumentList'
import DocumentPreview from './components/documents/DocumentPreview'
import { formatFileSize } from './utils/formatFileSize'
import { useDebounce } from './hooks/useDebounce'
import './App.css'

const initialFilters = initialSearchFilters
const emptyDocuments: StoredDocument[] = []

const App = () => {
  const queryClient = useQueryClient()
  const online = useNetworkStatus()
  const [page, setPage] = useState<WorkspacePage>('documents')
  const [filters, setFilters] = useState<SearchFiltersState>(initialFilters)
  const [previewDocument, setPreviewDocument] = useState<StoredDocument | null>(null)
  const [authenticated, setAuthenticated] = useState(() => Boolean(getApiToken()))
  const [toast, setToast] = useState('')
  const [uploadVersion, setUploadVersion] = useState(0)
  const [zipBusy, setZipBusy] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const debouncedSearch = useDebounce(filters.search, 300)
  const queryFilters = useMemo(() => ({
    category: filters.category,
    minorHead: filters.minorHead,
    search: debouncedSearch,
    from: filters.from,
    to: filters.to,
  }), [filters.category, filters.minorHead, filters.from, filters.to, debouncedSearch])
  const hasFilters = Object.values(queryFilters).some(Boolean)
  const allDocumentsQuery = useQuery({
    queryKey: ['documents', 'all'],
    queryFn: () => documentService.list(initialFilters),
    staleTime: 30_000,
    enabled: authenticated,
  })
  const filteredDocumentsQuery = useQuery({
    queryKey: ['documents', 'search', queryFilters],
    queryFn: () => documentService.list(queryFilters),
    enabled: authenticated && hasFilters,
    staleTime: 30_000,
  })
  const documentsQuery = hasFilters ? filteredDocumentsQuery : allDocumentsQuery
  const currentDocumentsQueryKey = useMemo(
    () => hasFilters
      ? ['documents', 'search', queryFilters] as const
      : ['documents', 'all'] as const,
    [hasFilters, queryFilters],
  )
  const documents = documentsQuery.data ?? emptyDocuments
  const allDocuments = allDocumentsQuery.data ?? emptyDocuments
  const existingTags = useMemo(
    () => Array.from(new Set(allDocuments.flatMap((document) => document.tags))),
    [allDocuments],
  )

  const uploadMutation = useMutation({
    mutationFn: (input: UploadInput) => documentService.add(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['documents'] })
      const queryKey = currentDocumentsQueryKey
      const previous = queryClient.getQueryData<StoredDocument[]>(queryKey)
      const optimistic: StoredDocument = {
        id: `pending-${crypto.randomUUID()}`,
        name: input.file.name,
        category: input.category,
        minorHead: input.minorHead,
        date: input.date,
        size: input.file.size,
        mimeType: input.file.type,
        tags: input.tags,
        remarks: input.remarks,
        fileBlob: input.file,
      }
      queryClient.setQueryData<StoredDocument[]>(queryKey, (current = []) => [optimistic, ...current])
      return { previous, queryKey }
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous)
      setToast(error instanceof Error ? error.message : 'Upload failed. Please try again.')
    },
    onSuccess: () => {
      setToast('Document uploaded successfully.')
      setPage('documents')
      setUploadVersion((version) => version + 1)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: documentService.remove,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['documents'] })
      const queryKey = currentDocumentsQueryKey
      const previous = queryClient.getQueryData<StoredDocument[]>(queryKey)
      queryClient.setQueryData<StoredDocument[]>(queryKey, (current = []) => current.filter((document) => document.id !== id))
      return { previous, queryKey }
    },
    onError: (error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous)
      setToast(error instanceof Error ? error.message : 'Could not delete document.')
    },
    onSuccess: () => setToast('Document deleted.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const tagMutation = useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) => documentService.addTag(id, tag),
    onMutate: async ({ id, tag }) => {
      await queryClient.cancelQueries({ queryKey: ['documents'] })
      const queryKey = currentDocumentsQueryKey
      const previous = queryClient.getQueryData<StoredDocument[]>(queryKey)
      queryClient.setQueryData<StoredDocument[]>(queryKey, (current = []) => current.map((document) => (
        document.id === id && !document.tags.includes(tag)
          ? { ...document, tags: [...document.tags, tag] }
          : document
      )))
      return { previous, queryKey }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous)
      setToast(error instanceof Error ? error.message : 'Could not save tag.')
    },
    onSuccess: () => setToast('Tag added.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
  const mutateUpload = uploadMutation.mutate
  const mutateTag = tagMutation.mutate
  const mutateDelete = deleteMutation.mutate

  useEffect(() => {
    if (toast) {
      const timeout = window.setTimeout(() => setToast(''), 3400)
      return () => window.clearTimeout(timeout)
    }
  }, [toast])

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  const filteredDocuments = useMemo(() => {
    const searchTerm = queryFilters.search.trim().toLowerCase()
    const searchTerms = searchTerm.split(/[,\s]+/).filter(Boolean)
    const results = documents.filter((document) => {
      const matchesCategory = !queryFilters.category || document.category === queryFilters.category
      const matchesHead = !queryFilters.minorHead || document.minorHead === queryFilters.minorHead
      const matchesText = searchTerms.every((term) => (
        document.name.toLowerCase().includes(term)
        || document.tags.some((tag) => tag.toLowerCase().includes(term))
      ))
      const matchesFrom = !queryFilters.from || document.date >= queryFilters.from
      const matchesTo = !queryFilters.to || document.date <= queryFilters.to
      return matchesCategory && matchesHead && matchesText && matchesFrom && matchesTo
    })
    return results.sort((first, second) => second.date.localeCompare(first.date))
  }, [documents, queryFilters])

  useEffect(() => {
    if (filteredDocuments.length) cacheSearchResults(filteredDocuments)
  }, [filteredDocuments])

  const downloadDocument = useCallback(async (document: StoredDocument) => {
    try {
      const blob = await documentService.getFile(document)
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = document.name
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not download this document.')
    }
  }, [])

  const downloadAll = useCallback(async () => {
    if (!filteredDocuments.length || zipBusy) return
    setZipBusy(true)
    const worker = new Worker(new URL('./workers/zip.worker.ts', import.meta.url), { type: 'module' })
    try {
      const files = await Promise.all(filteredDocuments.map(async (document) => {
        const fileBlob = await documentService.getFile(document)
        return { name: document.name, bytes: await fileBlob.arrayBuffer() }
      }))
      const archive = await new Promise<ArrayBuffer>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<{ archive?: ArrayBuffer; error?: string }>) => {
          if (event.data.error) reject(new Error(event.data.error))
          else if (event.data.archive) resolve(event.data.archive)
          else reject(new Error('The ZIP worker returned an invalid response.'))
        }
        worker.onerror = () => reject(new Error('The ZIP worker could not create the archive.'))
        worker.postMessage({ files }, files.map(({ bytes }) => bytes))
      })
      const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }))
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = 'elevate-documents.zip'
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setToast(`${filteredDocuments.length} documents bundled into a ZIP.`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not create the ZIP archive.')
    } finally {
      worker.terminate()
      setZipBusy(false)
    }
  }, [filteredDocuments, zipBusy])

  const handleUpload = useCallback((input: UploadInput) => mutateUpload(input), [mutateUpload])
  const handleAddTag = useCallback((document: StoredDocument) => {
    const tag = window.prompt(`Add a tag to “${document.name}”`)
    if (tag?.trim()) mutateTag({ id: document.id, tag: tag.trim().replace(/^#/, '') })
  }, [mutateTag])

  const resetFilters = useCallback(() => setFilters(initialFilters), [])
  const visibleCategories = useMemo(() => Array.from(new Set([
    'Personal',
    'Professional',
    ...allDocuments.map((document) => document.category),
  ])), [allDocuments])
  const heads = useMemo(() => Array.from(new Set(allDocuments
    .filter((document) => !filters.category || document.category === filters.category)
    .map((document) => document.minorHead))), [allDocuments, filters.category])
  const retryDocuments = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: currentDocumentsQueryKey }),
    [queryClient, currentDocumentsQueryKey],
  )
  const showCachedResults = useCallback(
    () => queryClient.setQueryData(currentDocumentsQueryKey, getCachedSearchResults() ?? []),
    [queryClient, currentDocumentsQueryKey],
  )
  const handleDownload = useCallback(
    (document: StoredDocument) => void downloadDocument(document),
    [downloadDocument],
  )
  const handleDelete = useCallback(
    (document: StoredDocument) => mutateDelete(document.id),
    [mutateDelete],
  )
  const handleSignOut = useCallback(() => {
    clearApiToken()
    queryClient.removeQueries({ queryKey: ['documents'] })
    clearCachedSearchResults()
    setPreviewDocument(null)
    setFilters(initialFilters)
    setAuthenticated(false)
  }, [queryClient])

  if (!authenticated) {
    return (
      <Login
        onAuthenticated={() => {
          queryClient.removeQueries({ queryKey: ['documents'] })
          setAuthenticated(true)
        }}
      />
    )
  }

  return (
    <Layout
      page={page}
      online={online}
      onNavigate={setPage}
      onUpload={() => setPage('upload')}
      onSignOut={handleSignOut}
    >
        {page === 'documents' && (
          <section className="page-body">
            <div className="page-intro">
              <div>
                <span className="eyebrow">DOCUMENTS</span>
                <h1>Documents, <em>in order.</em></h1>
              </div>
              <div className="intro-date"><span className="date-icon">▦</span><span><small>TODAY</small><strong>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</strong></span></div>
            </div>

            <section className="documents-panel">
              <div className="panel-heading">
                <div><h2>All documents <span className="result-count">{filteredDocuments.length}</span></h2><p>Search, preview and manage your files.</p></div>
                <button className="button button-outline zip-button" onClick={downloadAll} disabled={!filteredDocuments.length || zipBusy}>
                  <span>↓</span> {zipBusy ? 'Preparing ZIP…' : 'Download all'}
                </button>
              </div>
              <SearchFilters
                filters={filters}
                categories={visibleCategories}
                minorHeads={heads}
                searchRef={searchRef}
                onChange={setFilters}
                onClear={resetFilters}
              />
              <DocumentList
                documents={filteredDocuments}
                totalCount={allDocuments.length}
                isLoading={documentsQuery.isPending}
                errorMessage={documentsQuery.isError
                  ? documentsQuery.error instanceof Error ? documentsQuery.error.message : 'Please try again.'
                  : undefined}
                cachedResultsAvailable={Boolean(getCachedSearchResults()?.length)}
                onRetry={retryDocuments}
                onShowCached={showCachedResults}
                onPreview={setPreviewDocument}
                onDownload={handleDownload}
                onAddTag={handleAddTag}
                onDelete={handleDelete}
              />
            </section>
          </section>
        )}

        {page === 'upload' && (
          <section className="page-body subpage">
            <div className="page-intro compact-intro">
              <div><span className="eyebrow">DOCUMENT INTAKE</span><h1>Upload documents</h1></div>
            </div>
            <div className="upload-panel"><UploadForm key={uploadVersion} onUpload={handleUpload} isUploading={uploadMutation.isPending} existingTags={existingTags} /></div>
          </section>
        )}

        {page === 'admin' && (
          <section className="page-body subpage">
            <div className="page-intro compact-intro">
              <div><span className="eyebrow">USER MANAGEMENT</span><h1>Register</h1></div>
            </div>
            <UserRegistration />
          </section>
        )}

      {previewDocument && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPreviewDocument(null)}>
          <section className="modal-card preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <div className="preview-header"><div><span className="eyebrow">DOCUMENT PREVIEW</span><h2 id="preview-title">{previewDocument.name}</h2></div><button className="modal-close" onClick={() => setPreviewDocument(null)} aria-label="Close preview">×</button></div>
            <div className="preview-content"><DocumentPreview key={previewDocument.id} document={previewDocument} /></div>
            <div className="preview-footer"><span>{previewDocument.category} · {previewDocument.minorHead} · {formatFileSize(previewDocument.size)}</span><button className="button button-primary" onClick={() => void downloadDocument(previewDocument)}>Download file <span>↓</span></button></div>
          </section>
        </div>
      )}
      {toast && <div className="toast-message" role="status"><span>✓</span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
    </Layout>
  )
}

export default App
