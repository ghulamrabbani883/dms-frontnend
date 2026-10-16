import { zipSync } from 'fflate'

type ZipRequest = {
  files: Array<{ name: string; bytes: ArrayBuffer }>
}

self.onmessage = (event: MessageEvent<ZipRequest>) => {
  try {
    const entries: Record<string, Uint8Array> = {}
    const usedNames = new Set<string>()
    event.data.files.forEach(({ name, bytes }, index) => {
      const safeName = name.replaceAll('\\', '/').split('/').pop() || `document-${index + 1}`
      const separator = safeName.lastIndexOf('.')
      const base = separator > 0 ? safeName.slice(0, separator) : safeName
      const extension = separator > 0 ? safeName.slice(separator) : ''
      let uniqueName = safeName
      let suffix = 2
      while (usedNames.has(uniqueName)) {
        uniqueName = `${base} (${suffix})${extension}`
        suffix += 1
      }
      usedNames.add(uniqueName)
      entries[uniqueName] = new Uint8Array(bytes)
    })
    const archive = zipSync(entries, { level: 6 })
    self.postMessage({ archive: archive.buffer }, { transfer: [archive.buffer] })
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Could not create the ZIP archive.',
    })
  }
}
