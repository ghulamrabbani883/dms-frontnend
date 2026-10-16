type AutoTagRequest = {
  name: string
  mimeType: string
  size: number
}

type AutoTagResponse = {
  tags: string[]
  metadata: string
}

const categoryKeywords: Record<string, string[]> = {
  finance: ['finance', 'financial', 'invoice', 'receipt', 'expense', 'expenses', 'tax', 'payment', 'budget', 'bill', 'statement'],
  hr: ['hr', 'human', 'resources', 'onboarding', 'leave', 'payroll', 'resume', 'candidate', 'employee'],
  legal: ['legal', 'contract', 'agreement', 'vendor', 'signed', 'nda', 'compliance'],
  project: ['project', 'planning', 'roadmap', 'milestone', 'proposal'],
  security: ['security', 'audit', 'access', 'incident', 'compliance'],
  meeting: ['meeting', 'minutes', 'agenda', 'notes'],
  personal: ['personal', 'passport', 'identity', 'insurance', 'medical', 'travel'],
  design: ['design', 'mockup', 'review', 'prototype'],
}

const ignoredWords = new Set([
  'document', 'documents', 'file', 'files', 'final', 'copy', 'scan', 'scanned',
  'image', 'photo', 'new', 'the', 'and', 'for', 'with', 'of',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
])

self.onmessage = (event: MessageEvent<AutoTagRequest>) => {
  const { name, mimeType, size } = event.data
  const words = name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !ignoredWords.has(word) && !/^\d{2,}$/.test(word))

  const tags = new Set<string>()
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (words.some((word) => keywords.includes(word))) tags.add(category)
  }
  for (const word of words) {
    if (Object.values(categoryKeywords).some((keywords) => keywords.includes(word))) {
      tags.add(word === 'human' || word === 'resources' ? 'hr' : word)
    }
  }

  const fileType = mimeType === 'application/pdf'
    ? 'PDF'
    : mimeType.startsWith('image/')
      ? 'Image'
      : 'File'
  const sizeLabel = size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`
  const response: AutoTagResponse = {
    tags: [...tags],
    metadata: `${fileType} · ${sizeLabel} · filename analyzed`,
  }
  self.postMessage(response)
}
