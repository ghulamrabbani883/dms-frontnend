import { useEffect, useState } from 'react'
import { documentService } from '../../services/documentService'
import type { StoredDocument } from '../../types/documents'

type DocumentPreviewProps = {
  document: StoredDocument
}

const DocumentPreview = ({ document }: DocumentPreviewProps) => {
  const [localFileUrl, setLocalFileUrl] = useState('')
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    if (!document.fileBlob) return
    const url = URL.createObjectURL(document.fileBlob)
    const frame = window.requestAnimationFrame(() => setLocalFileUrl(url))
    return () => {
      window.cancelAnimationFrame(frame)
      URL.revokeObjectURL(url)
    }
  }, [document.fileBlob])

  const fileUrl = localFileUrl || (document.fileUrl ? documentService.getFileUrl(document) : '')

  if (document.mimeType.startsWith('image/') && fileUrl) {
    if (previewError) return <div className="preview-placeholder"><strong>Preview unavailable</strong><span>{previewError}</span></div>
    return <img src={fileUrl} alt={document.name} onError={() => setPreviewError('The image could not be loaded. Its link may have expired.')} />
  }
  if (document.mimeType.startsWith('image/')) {
    return <div className="preview-placeholder"><strong>Sample image preview</strong><span>The original file is not attached to this sample document.</span></div>
  }
  if (document.mimeType === 'application/pdf') {
    if (fileUrl) {
      return <iframe className="pdf-preview" src={fileUrl} title={`Preview of ${document.name}`} />
    }
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
