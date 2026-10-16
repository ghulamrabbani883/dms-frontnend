import { memo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '../../hooks/useDebounce'
import { tagService } from '../../services/tagService'
import { categories, uploadSchema, type UploadInput } from '../../types/documents'
import { getApiToken } from '../../services/api'

type UploadFormProps = {
  onUpload: (input: UploadInput) => void
  isUploading: boolean
  existingTags: string[]
}

const UploadForm = memo(({ onUpload, isUploading, existingTags }: UploadFormProps) => {
  const [category, setCategory] = useState<'Personal' | 'Professional'>('Professional')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [minorHead, setMinorHead] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [remarks, setRemarks] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const debouncedTagInput = useDebounce(tagInput.trim(), 300)
  const tagQuery = useQuery({
    queryKey: ['document-tags', debouncedTagInput],
    queryFn: () => tagService.search(debouncedTagInput),
    enabled: Boolean(getApiToken()) && debouncedTagInput.length > 1,
    staleTime: 30_000,
  })
  const tagSuggestions = [...new Set([
    ...(tagQuery.data ?? []),
    ...existingTags,
    'finance',
    'hr',
    'legal',
    'personal',
    'project',
    '2026',
  ])]
    .filter((tag) => !tags.includes(tag)
      && (!debouncedTagInput || tag.toLowerCase().includes(debouncedTagInput.toLowerCase())))

  const addTag = (value: string) => {
    const cleaned = value.trim().replace(/^#/, '')
    if (cleaned && !tags.some((tag) => tag.toLowerCase() === cleaned.toLowerCase())) {
      setTags((current) => [...current, cleaned])
    }
    setTagInput('')
  }

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagInput)
    } else if (event.key === 'Backspace' && !tagInput && tags.length) {
      setTags((current) => current.slice(0, -1))
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
          <p>Add a file and its details to your secure workspace.</p>
        </div>
        <span className="secure-note"><span className="secure-dot" /> Private workspace</span>
      </div>

      <button
        className={`dropzone${file ? ' has-file' : ''}`}
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const dropped = event.dataTransfer.files[0]
          if (dropped) setFile(dropped)
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
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
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
          <div className="tag-entry" onClick={(event) => event.currentTarget.querySelector('input')?.focus()}>
            {tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
                <button type="button" aria-label={`Remove ${tag} tag`} onClick={() => setTags((current) => current.filter((item) => item !== tag))}>×</button>
              </span>
            ))}
            <input
              value={tagInput}
              placeholder={tags.length ? 'Add another…' : 'Type a tag and press Enter'}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
            />
          </div>
          <span className="field-hint">
            {tagQuery.isError && <span role="status">Could not fetch saved tags. </span>}
            Suggested: {tagSuggestions.slice(0, 4).map((tag) => (
            <button className="suggestion" type="button" key={tag} onClick={() => addTag(tag)}>+ {tag}</button>
            ))}
          </span>
        </label>
        <label className="field field-wide">
          <span>Remarks <small>Optional</small></span>
          <textarea value={remarks} maxLength={500} rows={3} placeholder="Add context for this document…" onChange={(event) => setRemarks(event.target.value)} />
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-footer">
        <span className="field-hint">Your files are stored securely and only visible to you.</span>
        <button className="button button-primary" type="submit" disabled={isUploading}>
          {isUploading ? 'Saving…' : 'Upload document'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  )
})

UploadForm.displayName = 'UploadForm'
export default UploadForm
