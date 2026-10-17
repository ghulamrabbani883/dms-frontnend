import { memo, useEffect, useRef, useState, type FormEvent } from 'react'
import { categories, uploadSchema, type UploadInput } from '../../types/documents'
import TagInput from '../common/TagInput'
import { extractTextFromFile } from '../../utils/fileToText'
import { suggestDocumentTags } from '../../utils/suggestDocumentTags'

type UploadFormProps = {
  onUpload: (input: UploadInput) => void
  isUploading: boolean
}

const UploadForm = memo(({ onUpload, isUploading }: UploadFormProps) => {
  const [category, setCategory] = useState<'Personal' | 'Professional'>('Professional')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [minorHead, setMinorHead] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [remarks, setRemarks] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [autoTagSuggestions, setAutoTagSuggestions] = useState<string[]>([])
  const [autoTagMessage, setAutoTagMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const analysisAbort = useRef<AbortController | null>(null)
  const analysisId = useRef(0)

  useEffect(() => () => {
    analysisId.current += 1
    analysisAbort.current?.abort()
  }, [])

  const selectFile = (selectedFile: File) => {
    const currentAnalysisId = ++analysisId.current
    analysisAbort.current?.abort()
    const controller = new AbortController()
    analysisAbort.current = controller
    setFile(selectedFile)
    const filenameSuggestions = suggestDocumentTags(selectedFile.name, '')
    setAutoTagSuggestions(filenameSuggestions)
    setAutoTagMessage('Analyzing file contents locally…')

    const isCurrentAnalysis = () => analysisId.current === currentAnalysisId

    void (async () => {
      try {
        const { text, summary } = await extractTextFromFile(
          selectedFile,
          setAutoTagMessage,
          controller.signal,
        )
        if (!isCurrentAnalysis()) return
        const suggestions = suggestDocumentTags(selectedFile.name, text)
        setAutoTagSuggestions(suggestions)
        setAutoTagMessage(suggestions.length
          ? `${summary}; extracted ${suggestions.length} tag suggestion(s) from the content.`
          : `${summary}; no useful text terms were found. You can add tags manually.`)
      } catch (analysisError) {
        if (!isCurrentAnalysis()) return
        console.error('Could not analyze the selected document for tag suggestions.', analysisError)
        setAutoTagSuggestions(filenameSuggestions)
        setAutoTagMessage('Could not read document content. Filename suggestions are shown; add tags manually.')
      } finally {
        if (analysisAbort.current === controller) analysisAbort.current = null
      }
    })()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = uploadSchema.safeParse({ file, date, category, minorHead, tags, remarks })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Please check the form and try again.')
      return
    }
    setError('')
    onUpload(result.data)
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">DOCUMENT INTAKE</span>
          <h2>Upload a document</h2>
          <p>Add a file and its details.</p>
        </div>
      </div>

      <button
        className={`dropzone${file ? ' has-file' : ''}`}
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const dropped = event.dataTransfer.files[0]
          if (dropped) selectFile(dropped)
        }}
      >
        <span className="upload-cloud" aria-hidden="true">↑</span>
        <strong>{file ? file.name : 'Drop your file here, or browse'}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${file.type || 'file'}` : 'PDF or image · up to 20 MB'}</span>
        <input
          ref={fileInput}
          aria-label="Choose a PDF or image file"
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(event) => {
            const selectedFile = event.target.files?.[0]
            if (selectedFile) selectFile(selectedFile)
          }}
        />
      </button>

      <div className="form-grid">
        <label className="field">
          <span>Document date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => {
              const next = event.target.value as 'Personal' | 'Professional'
              setCategory(next)
              setMinorHead('')
            }}
          >
            <option value="Professional">Professional</option>
            <option value="Personal">Personal</option>
          </select>
        </label>
        <label className="field">
          <span>{category === 'Personal' ? 'Person' : 'Department'}</span>
          <select value={minorHead} onChange={(event) => setMinorHead(event.target.value)}>
            <option value="">Select {category === 'Personal' ? 'a person' : 'a department'}</option>
            {categories[category].map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <label className="field field-wide">
          <span>Tags</span>
          <TagInput
            tags={tags}
            onChange={setTags}
            inputLabel="Add document tags"
            placeholder={tags.length ? 'Add another…' : 'Type a tag and press Enter'}
            existingTags={autoTagSuggestions}
            showAllSuggestions
            maxSuggestions={15}
            suggestionsEnabled={Boolean(file)}
            fetchOnMount
            maxTags={15}
          />
          {file && <span className="auto-tag-message" role="status">{autoTagMessage}</span>}
          {file && <span className="field-hint">Text is analyzed on this device. PDFs use embedded text when available and OCR for scanned pages; OCR supports English.</span>}
        </label>
        <label className="field field-wide">
          <span>Remarks <small>Optional</small></span>
          <textarea value={remarks} maxLength={500} rows={3} placeholder="Add context for this document…" onChange={(event) => setRemarks(event.target.value)} />
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-footer">
        <button className="button button-primary" type="submit" disabled={isUploading}>
          {isUploading ? 'Saving…' : 'Upload document'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  )
})

UploadForm.displayName = 'UploadForm'
export default UploadForm
