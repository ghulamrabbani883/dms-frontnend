import { memo, useMemo, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '../../hooks/useDebounce'
import { getApiToken } from '../../services/api'
import { tagService } from '../../services/tagService'

type TagInputProps = {
  tags: string[]
  onChange: (tags: string[]) => void
  inputLabel: string
  placeholder: string
  existingTags?: string[]
  fetchOnMount?: boolean
}

const TagInput = memo(({
  tags,
  onChange,
  inputLabel,
  placeholder,
  existingTags = [],
  fetchOnMount = false,
}: TagInputProps) => {
  const [input, setInput] = useState('')
  const debouncedInput = useDebounce(input.trim(), 300)
  const tagQuery = useQuery({
    queryKey: ['document-tags', debouncedInput],
    queryFn: () => tagService.search(debouncedInput),
    enabled: Boolean(getApiToken()) && (fetchOnMount || debouncedInput.length > 1),
    staleTime: 30_000,
  })
  const suggestions = useMemo(() => [...new Set([
    ...(tagQuery.data ?? []),
    ...existingTags,
  ])].filter((tag) => !tags.some((current) => current.toLowerCase() === tag.toLowerCase())
    && (!debouncedInput || tag.toLowerCase().includes(debouncedInput.toLowerCase()))),
  [debouncedInput, existingTags, tagQuery.data, tags])

  const addTag = (value: string) => {
    const tag = value.trim().replace(/^#/, '')
    if (tag && !tags.some((current) => current.toLowerCase() === tag.toLowerCase())) {
      onChange([...tags, tag])
    }
    setInput('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(input)
    } else if (event.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <>
      <div className="tag-entry" onClick={(event) => event.currentTarget.querySelector('input')?.focus()}>
        {tags.map((tag) => (
          <span className="tag-chip" key={tag}>
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag} tag`}
              onClick={() => onChange(tags.filter((current) => current !== tag))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          aria-label={inputLabel}
          value={input}
          placeholder={placeholder}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {(tagQuery.isError || suggestions.length > 0) && (
        <span className="field-hint">
          {tagQuery.isError && <span role="status">Could not fetch saved tags. </span>}
          {suggestions.length > 0 && <>Suggested: {suggestions.slice(0, 4).map((tag) => (
            <button className="suggestion" type="button" key={tag} onClick={() => addTag(tag)}>+ {tag}</button>
          ))}</>}
        </span>
      )}
    </>
  )
})

TagInput.displayName = 'TagInput'
export default TagInput
