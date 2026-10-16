import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { API_BASE_URL, clearApiToken, getApiToken } from './services/api'
import SearchFilters from './components/documents/SearchFilters'
import DocumentList from './components/documents/DocumentList'
import DocumentPreview from './components/documents/DocumentPreview'
import NaturalLanguageSearch from './components/documents/NaturalLanguageSearch'
import { formatFileSize } from './utils/formatFileSize'
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

  const queryFilters = useMemo(() => ({
    category: filters.category,
    minorHead: filters.minorHead,
    tags: filters.tags,
    from: filters.from,
    to: filters.to,
  }), [filters.category, filters.minorHead, filters.tags, filters.from, filters.to])
  const hasFilters = Boolean(
    queryFilters.category
    || queryFilters.minorHead
    || queryFilters.tags.length
    || queryFilters.from
    || queryFilters.to,
  )
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

  const mutateUpload = uploadMutation.mutate

  useEffect(() => {
    if (toast) {
      const timeout = window.setTimeout(() => setToast(''), 3400)
      return () => window.clearTimeout(timeout)
    }
  }, [toast])

  const filteredDocuments = useMemo(() => {
    const results = documents.filter((document) => {
      const matchesCategory = !queryFilters.category || document.category === queryFilters.category
      const matchesHead = !queryFilters.minorHead || document.minorHead === queryFilters.minorHead
      const matchesFrom = !queryFilters.from || document.date >= queryFilters.from
      const matchesTo = !queryFilters.to || document.date <= queryFilters.to
      return matchesCategory && matchesHead && matchesFrom && matchesTo
    })
    return results.sort((first, second) => second.date.localeCompare(first.date))
  }, [documents, queryFilters])

  useEffect(() => {
    if (filteredDocuments.length) cacheSearchResults(filteredDocuments)
  }, [filteredDocuments])

  const downloadDocument = useCallback(async (document: StoredDocument) => {
    try {
      if (document.fileUrl) {
        const fileUrl = documentService.getFileUrl(document)
        if (new URL(fileUrl).origin !== new URL(API_BASE_URL).origin) {
          const anchor = window.document.createElement('a')
          anchor.href = fileUrl
          anchor.download = document.name
          anchor.target = '_blank'
          anchor.rel = 'noopener noreferrer'
          anchor.click()
          return
        }
      }
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
    if (!filteredDocuments.length) return
    setZipBusy(true)
    let worker: Worker | undefined
    try {
      const files = await Promise.all(filteredDocuments.map(async (document) => {
        const fileBlob = await documentService.getFile(document)
        return { name: document.name, bytes: await fileBlob.arrayBuffer() }
      }))
      const zipWorker = new Worker(new URL('./workers/zip.worker.ts', import.meta.url), { type: 'module' })
      worker = zipWorker
      const archive = await new Promise<ArrayBuffer>((resolve, reject) => {
        zipWorker.onmessage = (event: MessageEvent<{ archive?: ArrayBuffer; error?: string }>) => {
          if (event.data.error) reject(new Error(event.data.error))
          else if (event.data.archive) resolve(event.data.archive)
          else reject(new Error('The ZIP worker returned an invalid response.'))
        }
        zipWorker.onerror = () => reject(new Error('The ZIP worker could not create the archive.'))
        zipWorker.postMessage({ files }, files.map(({ bytes }) => bytes))
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
      worker?.terminate()
      setZipBusy(false)
    }
  }, [filteredDocuments])

  const handleUpload = useCallback((input: UploadInput) => mutateUpload(input), [mutateUpload])

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
                <button className="button button-outline zip-button" onClick={() => void downloadAll()} disabled={!filteredDocuments.length || zipBusy}>
                  <span>↓</span> {zipBusy ? 'Preparing ZIP…' : 'Download all'}
                </button>
              </div>
              <NaturalLanguageSearch onApply={setFilters} />
              <SearchFilters
                filters={filters}
                categories={visibleCategories}
                minorHeads={heads}
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
              />
            </section>
          </section>
        )}

        {page === 'upload' && (
          <section className="page-body subpage">
            <div className="page-intro compact-intro">
              <div><span className="eyebrow">DOCUMENT INTAKE</span><h1>Upload documents</h1></div>
            </div>
            <div className="upload-panel"><UploadForm key={uploadVersion} onUpload={handleUpload} isUploading={uploadMutation.isPending} /></div>
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
