import type * as PdfJs from 'pdfjs-dist'
import type { Worker as OcrWorker } from 'tesseract.js'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const maxPdfPagesToAnalyze = 5
const maxCanvasDimension = 2400

export type FileTextProgress = (message: string) => void

const renderPdfPage = async (page: PdfJs.PDFPageProxy) => {
  const initialViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(1.5, maxCanvasDimension / Math.max(initialViewport.width, initialViewport.height))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the PDF page for OCR.')
  await page.render({ canvas, canvasContext: context, viewport }).promise
  return canvas
}

export const extractTextFromFile = async (
  file: File,
  reportProgress: FileTextProgress,
  signal: AbortSignal,
) => {
  const checkCancelled = () => {
    if (signal.aborted) throw new DOMException('File analysis was cancelled.', 'AbortError')
  }
  let ocrWorker: OcrWorker | null = null
  let terminatingWorker: Promise<unknown> | null = null
  const terminateOcrWorker = () => {
    if (ocrWorker && !terminatingWorker) {
      terminatingWorker = ocrWorker.terminate()
    }
    return terminatingWorker
  }
  const handleAbort = () => {
    void terminateOcrWorker()
  }
  signal.addEventListener('abort', handleAbort, { once: true })

  const getOcrWorker = async () => {
    checkCancelled()
    if (!ocrWorker) {
      reportProgress('Loading English OCR data…')
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: ({ status, progress }) => {
          if (!signal.aborted && progress > 0) {
            reportProgress(`OCR: ${status} · ${Math.round(progress * 100)}%`)
          }
        },
      })
      if (signal.aborted) {
        await worker.terminate()
        checkCancelled()
      }
      ocrWorker = worker
    }
    return ocrWorker
  }

  try {
    checkCancelled()
    if (file.type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
      try {
        const pdf = await loadingTask.promise
        const pagesToRead = Math.min(pdf.numPages, maxPdfPagesToAnalyze)
        const textChunks: string[] = []
        for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
          checkCancelled()
          reportProgress(`Reading PDF page ${pageNumber} of ${pagesToRead}…`)
          const page = await pdf.getPage(pageNumber)
          const textContent = await page.getTextContent()
          const pageText = textContent.items
            .flatMap((item) => 'str' in item ? [item.str] : [])
            .join(' ')
            .trim()

          if (pageText.length >= 30) {
            textChunks.push(pageText)
          } else {
            reportProgress(`Running OCR on scanned PDF page ${pageNumber} of ${pagesToRead}…`)
            const canvas = await renderPdfPage(page)
            try {
              const result = await (await getOcrWorker()).recognize(canvas)
              textChunks.push(result.data.text)
            } finally {
              canvas.width = 0
              canvas.height = 0
            }
          }
        }
        checkCancelled()
        return {
          text: textChunks.join(' '),
          summary: `Read ${pagesToRead} of ${pdf.numPages} PDF page(s)`,
        }
      } finally {
        await loadingTask.destroy()
      }
    }

    if (file.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, maxCanvasDimension / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      try {
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Could not prepare the image for OCR.')
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const text = (await (await getOcrWorker()).recognize(canvas)).data.text
        checkCancelled()
        return { text, summary: 'Read image content with English OCR' }
      } finally {
        bitmap.close()
        canvas.width = 0
        canvas.height = 0
      }
    }

    throw new Error('Choose a supported PDF or image file.')
  } finally {
    signal.removeEventListener('abort', handleAbort)
    await terminateOcrWorker()
  }
}
