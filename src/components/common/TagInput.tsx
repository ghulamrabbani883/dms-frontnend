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
  showAllSuggestions?: boolean
  suggestionsEnabled?: boolean
  maxTags?: number
  maxSuggestions?: number
}

const TagInput = memo(({
  tags,
  onChange,
  inputLabel,
  placeholder,
  existingTags = [],
  fetchOnMount = false,
  showAllSuggestions = false,
  suggestionsEnabled = true,
  maxTags,
  maxSuggestions,
}: TagInputProps) => {
  const [input, setInput] = useState('')
  const debouncedInput = useDebounce(input.trim(), 300)
  const tagQuery = useQuery({
    queryKey: ['document-tags', debouncedInput],
    queryFn: () => tagService.search(debouncedInput),
    enabled: suggestionsEnabled && Boolean(getApiToken()) && (fetchOnMount || debouncedInput.length > 1),
    staleTime: 30_000,
  })
  const suggestions = useMemo(() => {
    const backendTags = tagQuery.data ?? []
    const combined = Array.from(
      { length: Math.max(backendTags.length, existingTags.length) },
      (_, index) => [backendTags[index], existingTags[index]],
    ).flat()
    return [...new Set(combined.filter((tag): tag is string => Boolean(tag)))]
      .filter((tag) => !tags.some((current) => current.toLowerCase() === tag.toLowerCase())
        && (!debouncedInput || tag.toLowerCase().includes(debouncedInput.toLowerCase())))
  },
  [debouncedInput, existingTags, tagQuery.data, tags])
  const atTagLimit = maxTags !== undefined && tags.length >= maxTags
  const suggestionLimit = maxSuggestions ?? (showAllSuggestions ? suggestions.length : 4)
  const visibleSuggestions = atTagLimit ? [] : suggestions.slice(0, suggestionLimit)

  const addTag = (value: string) => {
    const tag = value.trim().replace(/^#/, '')
    if (
      tag
      && !tags.some((current) => current.toLowerCase() === tag.toLowerCase())
      && (maxTags === undefined || tags.length < maxTags)
    ) {
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
          placeholder={maxTags !== undefined && tags.length >= maxTags ? `Maximum ${maxTags} tags` : placeholder}
          disabled={maxTags !== undefined && tags.length >= maxTags}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {atTagLimit && (
        <span className="field-hint" role="status">Maximum of {maxTags} tags reached. Remove a tag to add another.</span>
      )}
      {suggestionsEnabled && (tagQuery.isError || visibleSuggestions.length > 0) && (
        <span className="field-hint">
          {tagQuery.isError && <span role="status">Could not fetch saved tags. </span>}
          {visibleSuggestions.length > 0 && <>Suggested (up to {suggestionLimit}): {visibleSuggestions.map((tag) => (
            <button className="suggestion" type="button" key={tag} onClick={() => addTag(tag)}>+ {tag}</button>
          ))}</>}
        </span>
      )}
    </>
  )
})

TagInput.displayName = 'TagInput'
export default TagInput
