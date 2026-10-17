const commonWords = new Set([
  'about', 'after', 'again', 'also', 'among', 'and', 'are', 'because', 'been', 'before',
  'being', 'between', 'both', 'but', 'can', 'could', 'did', 'does', 'each', 'either',
  'else', 'from', 'get', 'got', 'had', 'has', 'have', 'her', 'here', 'him', 'his',
  'how', 'into', 'its', 'just', 'less', 'may', 'might', 'more', 'most', 'must', 'not',
  'our', 'out', 'over', 'same', 'should', 'some', 'such', 'than', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'until',
  'upon', 'very', 'was', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'will',
  'with', 'within', 'without', 'would', 'you', 'your', 'document', 'documents', 'page',
  'pages', 'file', 'files', 'scan', 'scanned', 'image', 'images', 'copy', 'final',
  'for', 'contains',
])

const normalizedWords = (text: string) => (text.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
  .filter((word) => word.length >= 3 && !commonWords.has(word) && !/^\d+$/.test(word))

const addToFrequency = (frequencies: Map<string, number>, term: string) => {
  frequencies.set(term, (frequencies.get(term) ?? 0) + 1)
}

const contentTerms = (text: string) => {
  const words = normalizedWords(text)
  const frequencies = new Map<string, number>()
  words.forEach((word) => addToFrequency(frequencies, word))

  return [...frequencies.entries()]
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .map(([term]) => term)
}

export const suggestDocumentTags = (name: string, text: string): string[] => {
  const fromContent = contentTerms(text)
  const fromFilename = contentTerms(name.replace(/\.[^.]+$/, ''))
  return [...new Set([...fromContent, ...fromFilename])].slice(0, 15)
}
