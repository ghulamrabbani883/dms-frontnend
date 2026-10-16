import { useEffect, useState } from 'react'
import { documentService } from '../../services/documentService'
import type { StoredDocument } from '../../types/documents'

type DocumentPreviewProps = {
  document: StoredDocument
}

const DocumentPreview = ({ document }: DocumentPreviewProps) => {
  const [fileUrl, setFileUrl] = useState('')
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    if (!document.fileBlob && !document.fileUrl) return
    let active = true
    let objectUrl = ''
    void documentService.getFile(document).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setFileUrl(objectUrl)
    }).catch((error: unknown) => {
      if (active) setPreviewError(error instanceof Error ? error.message : 'Could not load document preview.')
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document])

  if (document.mimeType.startsWith('image/') && (document.fileBlob || document.fileUrl)) {
    if (fileUrl) return <img src={fileUrl} alt={document.name} />
    if (previewError) return <div className="preview-placeholder"><strong>Preview unavailable</strong><span>{previewError}</span></div>
    return <div className="preview-placeholder"><span>Loading preview…</span></div>
  }
  if (document.mimeType.startsWith('image/')) {
    return <div className="preview-placeholder"><strong>Sample image preview</strong><span>The original file is not attached to this sample document.</span></div>
  }
  if (document.mimeType === 'application/pdf') {
    if (fileUrl && (document.fileBlob || document.fileUrl)) {
      return <iframe className="pdf-preview" src={fileUrl} title={`Preview of ${document.name}`} />
    }
    if (previewError) return <div className="preview-placeholder"><strong>Preview unavailable</strong><span>{previewError}</span></div>
    return (
      <div className="preview-placeholder">
        <span className="preview-file-icon">PDF</span>
        <strong>Sample PDF preview</strong>
        <span>The original file is not attached to this sample document.</span>
      </div>
    )
  }
  return <div className="preview-placeholder"><strong>Preview unavailable</strong><span>This file type is not supported for preview.</span></div>
}

export default DocumentPreview
