import { memo, useEffect, useRef, useState, type FormEvent } from 'react'
import { categories, uploadSchema, type UploadInput } from '../../types/documents'
import TagInput from '../common/TagInput'

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
  const autoTagWorker = useRef<Worker | null>(null)

  useEffect(() => () => autoTagWorker.current?.terminate(), [])

  const selectFile = (selectedFile: File) => {
    setFile(selectedFile)
    setAutoTagSuggestions([])
    setAutoTagMessage('Analyzing filename for suggested tags…')
    autoTagWorker.current?.terminate()
    autoTagWorker.current = null

    try {
      const worker = new Worker(new URL('../../workers/autoTag.worker.ts', import.meta.url), { type: 'module' })
      autoTagWorker.current = worker
      worker.onmessage = (event: MessageEvent<{ tags: string[]; metadata: string }>) => {
        if (autoTagWorker.current !== worker) return
        autoTagWorker.current = null
        worker.terminate()
        setAutoTagSuggestions(event.data.tags)
        setAutoTagMessage(event.data.tags.length
          ? `Suggested from filename · ${event.data.metadata}`
          : `No obvious tags found · ${event.data.metadata}`)
      }
      worker.onerror = () => {
        if (autoTagWorker.current !== worker) return
        autoTagWorker.current = null
        worker.terminate()
        setAutoTagMessage('Could not generate tag suggestions. Add tags manually.')
      }
      worker.postMessage({ name: selectedFile.name, mimeType: selectedFile.type, size: selectedFile.size })
    } catch (workerError) {
      autoTagWorker.current?.terminate()
      autoTagWorker.current = null
      console.error('Could not start the upload tag suggestion worker.', workerError)
      setAutoTagMessage('Could not generate tag suggestions. Add tags manually.')
    }
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
            fetchOnMount
          />
          <span className="auto-tag-message" role="status">{autoTagMessage}</span>
          <span className="field-hint">Suggestions are simulated from the filename and file metadata; file contents are not read.</span>
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
