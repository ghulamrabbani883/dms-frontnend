import { memo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { StoredDocument } from '../../types/documents'
import { formatFileSize } from '../../utils/formatFileSize'

type DocumentListProps = {
  documents: StoredDocument[]
  totalCount: number
  isLoading: boolean
  errorMessage?: string
  cachedResultsAvailable: boolean
  onRetry: () => void
  onShowCached: () => void
  onPreview: (document: StoredDocument) => void
  onDownload: (document: StoredDocument) => void
  onAddTag: (document: StoredDocument) => void
  onDelete: (document: StoredDocument) => void
}

const fileKind = (mimeType: string) => mimeType === 'application/pdf' ? 'PDF' : 'IMG'
const DocumentList = memo(({
  documents,
  totalCount,
  isLoading,
  errorMessage,
  cachedResultsAvailable,
  onRetry,
  onShowCached,
  onPreview,
  onDownload,
  onAddTag,
  onDelete,
}: DocumentListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  // TanStack Virtual returns a mutable virtualizer instance, so keep it in this UI component.
  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 76,
    overscan: 8,
    getItemKey: (index) => documents[index]?.id ?? index,
  })

  return (
    <>
      {errorMessage && (
        <div className="query-error" role="alert">
          <strong>{documents.length ? 'Showing saved results; refresh failed.' : 'Couldn’t load your documents.'}</strong>
          <span>{errorMessage}</span>
          {cachedResultsAvailable && <button type="button" onClick={onShowCached}>Show cached results</button>}
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      )}
      {isLoading && <div className="empty-state">Loading documents…</div>}
      {!isLoading && !documents.length && (
        <div className="empty-state">
          <span className="empty-icon">⌕</span>
          <strong>No documents found</strong>
          <span>Try a different search or adjust your filters.</span>
        </div>
      )}
      {!!documents.length && (
        <>
          <div className="document-table-header">
            <span>NAME</span><span>CATEGORY</span><span>DATE ADDED</span><span>FILE SIZE</span><span>TAGS</span><span aria-label="Actions" />
          </div>
          <div className="virtual-list" ref={scrollRef} role="list" aria-label="Documents">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const document = documents[virtualRow.index]
                if (!document) return null
                const kind = fileKind(document.mimeType)
                return (
                  <div
                    className="document-row"
                    role="listitem"
                    key={document.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="document-name-cell">
                      <span className={`file-badge ${kind.toLowerCase()}`}>{kind}</span>
                      <span className="document-title"><strong title={document.name}>{document.name}</strong><small>{document.minorHead}</small></span>
                    </div>
                    <div><span className={`category-pill ${document.category.toLowerCase()}`}><i />{document.category}</span></div>
                    <span className="document-date">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${document.date}T12:00:00`))}</span>
                    <span className="document-size">{formatFileSize(document.size)}</span>
                    <div className="document-tags">
                      {document.tags.slice(0, 2).map((tag) => <span className="table-tag" key={tag}>{tag}</span>)}
                      {document.tags.length > 2 && <span className="more-tags">+{document.tags.length - 2}</span>}
                    </div>
                    <div className="row-actions">
                      <button aria-label={`Preview ${document.name}`} title="Preview" onClick={() => onPreview(document)}>◉</button>
                      <button aria-label={`Download ${document.name}`} title="Download" onClick={() => onDownload(document)}>↓</button>
                      <button aria-label={`Add a tag to ${document.name}`} title="Add tag" onClick={() => onAddTag(document)}>＋</button>
                      <button className="delete-action" aria-label={`Delete ${document.name}`} title="Delete" onClick={() => onDelete(document)}>×</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="table-footer">
            <span>Showing <strong>{documents.length.toLocaleString()}</strong> of {totalCount.toLocaleString()} documents</span>
            <span>Results are cached for offline access</span>
          </div>
        </>
      )}
    </>
  )
})

DocumentList.displayName = 'DocumentList'
export default DocumentList
