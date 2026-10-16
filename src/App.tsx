import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import UploadForm from './components/documents/UploadForm'
import UserRegistration from './components/administration/UserRegistration'
import Login from './components/login/Login'
import { documentService } from './services/documentService'
import { cacheSearchResults, getCachedSearchResults } from './storage/searchCache'
import { type StoredDocument, type UploadInput } from './types/documents'
import { initialSearchFilters, type SearchFiltersState } from './types/search'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { getApiToken } from './services/api'
import SearchFilters from './components/documents/SearchFilters'
import DocumentList from './components/documents/DocumentList'
import DocumentPreview from './components/documents/DocumentPreview'
import OfflineBanner from './components/common/OfflineBanner'
import { formatFileSize } from './utils/formatFileSize'
import { useDebounce } from './hooks/useDebounce'
import './App.css'

type Page = 'documents' | 'upload' | 'admin'
const initialFilters = initialSearchFilters
const emptyDocuments: StoredDocument[] = []

const App = () => {
  const queryClient = useQueryClient()
  const online = useNetworkStatus()
  const [page, setPage] = useState<Page>('documents')
  const [filters, setFilters] = useState<SearchFiltersState>(initialFilters)
  const [previewDocument, setPreviewDocument] = useState<StoredDocument | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [userName, setUserName] = useState(() => getApiToken() ? 'Workspace member' : 'Ayesha Khan')
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
  })
  const filteredDocumentsQuery = useQuery({
    queryKey: ['documents', 'search', queryFilters],
    queryFn: () => documentService.list(queryFilters),
    enabled: hasFilters,
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('documents') }}>
          <span className="brand-mark"><span /></span>
          <span>elevate<span className="brand-period">.</span><small>DOCUMENTS</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={page === 'documents' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('documents')}>
            <span className="nav-icon">▤</span> Documents <span className="nav-count">{documents.length}</span>
          </button>
          <button className={page === 'upload' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('upload')}>
            <span className="nav-icon">＋</span> Upload files
          </button>
          <button className={page === 'admin' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('admin')}>
            <span className="nav-icon">♙</span> Administration
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-card">
            <span className="storage-icon">✳</span>
            <strong>Your workspace</strong>
            <span>{documents.length} documents · private</span>
            <div className="storage-track"><i style={{ width: `${Math.min(92, documents.length * 3)}%` }} /></div>
            <small>Securely organized and ready to find</small>
          </div>
          <button className="help-link" onClick={() => setToast('Tip: use tags and date filters to narrow your search.')}>
            <span>ⓘ</span> Help & support <span className="help-arrow">↗</span>
          </button>
          <button className="profile-card" onClick={() => setShowLogin(true)}>
            <span className="avatar">{userName === 'Ayesha Khan' ? 'AK' : userName.slice(0, 2).toUpperCase()}</span>
            <span className="profile-copy"><strong>{userName}</strong><small>Workspace owner</small></span>
            <span className="profile-menu">···</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{page === 'documents' ? 'Documents' : page === 'upload' ? 'Upload' : 'Administration'}</strong></div>
          <div className="topbar-actions">
            <OfflineBanner online={online} />
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast('You’re all caught up.')}>♧<i /></button>
            <button className="button button-primary top-upload" onClick={() => setPage('upload')}><span>＋</span> Upload document</button>
          </div>
        </header>

        {page === 'documents' && (
          <section className="page-body">
            <div className="page-intro">
              <div>
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h1>Documents, <em>in order.</em></h1>
                <p>Everything you need, right where you left it.</p>
              </div>
              <div className="intro-date"><span className="date-icon">▦</span><span><small>TODAY</small><strong>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</strong></span></div>
            </div>

            <div className="stats-grid">
              <article className="stat-card"><span className="stat-icon violet">▤</span><span className="stat-label">Total documents</span><strong>{allDocuments.length.toLocaleString()}</strong><small><i className="stat-trend">↗</i> In your workspace</small></article>
              <article className="stat-card"><span className="stat-icon blue">⌕</span><span className="stat-label">Categories</span><strong>{visibleCategories.length || 2}</strong><small>Personal & professional</small></article>
              <article className="stat-card"><span className="stat-icon orange">◷</span><span className="stat-label">Added this month</span><strong>{documents.filter((document) => document.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).length}</strong><small>Across all categories</small></article>
              <article className="stat-card stat-highlight"><span className="stat-icon green">✓</span><span className="stat-label">Workspace status</span><strong>All in sync</strong><small><i className="online-dot" /> Your documents are up to date</small></article>
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
            <footer className="page-footer"><span>© 2026 Elevate Documents</span><span>Thoughtfully organized, securely stored.</span></footer>
          </section>
        )}

        {page === 'upload' && (
          <section className="page-body subpage">
            <div className="page-intro compact-intro">
              <div><span className="eyebrow">DOCUMENT INTAKE</span><h1>Make room for <em>what matters.</em></h1><p>Upload and organize a new document in seconds.</p></div>
            </div>
            <div className="upload-panel"><UploadForm key={uploadVersion} onUpload={handleUpload} isUploading={uploadMutation.isPending} existingTags={existingTags} /></div>
            <footer className="page-footer"><span>© 2026 Elevate Documents</span><span>Thoughtfully organized, securely stored.</span></footer>
          </section>
        )}

        {page === 'admin' && (
          <section className="page-body subpage">
            <div className="page-intro compact-intro">
              <div><span className="eyebrow">WORKSPACE SETTINGS</span><h1>People make <em>the work.</em></h1><p>Create a workspace user account.</p></div>
            </div>
            <UserRegistration />
            <footer className="page-footer"><span>© 2026 Elevate Documents</span><span>Thoughtfully organized, securely stored.</span></footer>
          </section>
        )}
      </main>

      {previewDocument && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPreviewDocument(null)}>
          <section className="modal-card preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <div className="preview-header"><div><span className="eyebrow">DOCUMENT PREVIEW</span><h2 id="preview-title">{previewDocument.name}</h2></div><button className="modal-close" onClick={() => setPreviewDocument(null)} aria-label="Close preview">×</button></div>
            <div className="preview-content"><DocumentPreview key={previewDocument.id} document={previewDocument} /></div>
            <div className="preview-footer"><span>{previewDocument.category} · {previewDocument.minorHead} · {formatFileSize(previewDocument.size)}</span><button className="button button-primary" onClick={() => void downloadDocument(previewDocument)}>Download file <span>↓</span></button></div>
          </section>
        </div>
      )}
      {showLogin && <Login
        onClose={() => setShowLogin(false)}
        authenticated={authenticated}
        onAuthenticated={(name) => {
          setUserName(name)
          setAuthenticated(true)
          void queryClient.invalidateQueries({ queryKey: ['documents'] })
          setToast('You’re signed in.')
        }}
        onSignOut={() => {
          setAuthenticated(false)
          setUserName('Ayesha Khan')
          void queryClient.invalidateQueries({ queryKey: ['documents'] })
          setToast('You’re signed out. Showing local demo data.')
        }}
      />}
      {toast && <div className="toast-message" role="status"><span>✓</span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
    </div>
  )
}

export default App
