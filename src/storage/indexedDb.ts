import { z } from 'zod'
import {
  demoDocuments,
  documentSchema,
  type StoredDocument,
} from '../types/documents'

const databaseName = 'elevate-documents'
const storeName = 'documents'

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('Could not open document storage.'))
})

const requestFromStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    request.onerror = () => reject(request.error ?? new Error('Document storage request failed.'))
    transaction.oncomplete = () => {
      database.close()
      resolve(request.result)
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error('Document storage transaction was aborted.'))
    }
    transaction.onerror = () => reject(transaction.error ?? new Error('Document storage transaction failed.'))
  })
}

const parseStoredDocument = (document: StoredDocument): StoredDocument => ({
  ...documentSchema.parse(document),
  ...(document.fileBlob instanceof Blob ? { fileBlob: document.fileBlob } : {}),
  ...(document.fileUrl ? { fileUrl: z.string().min(1).parse(document.fileUrl) } : {}),
})

const seedDocuments = async (): Promise<StoredDocument[]> => {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    demoDocuments.forEach((document) => store.put(document))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not seed demo documents.'))
  })
  database.close()
  return demoDocuments
}

export const indexedDb = {
  async listDocuments(): Promise<StoredDocument[]> {
    const documents = await requestFromStore<StoredDocument[]>('readonly', (store) => store.getAll())
    if (!documents.length) return seedDocuments()
    return documents.map(parseStoredDocument)
  },

  async getDocument(id: string): Promise<StoredDocument | undefined> {
    const document = await requestFromStore<StoredDocument | undefined>('readonly', (store) => store.get(id))
    return document ? parseStoredDocument(document) : undefined
  },

  async saveDocument(document: StoredDocument): Promise<void> {
    const validated = parseStoredDocument(document)
    await requestFromStore<IDBValidKey>('readwrite', (store) => store.put(validated))
  },

  async deleteDocument(id: string): Promise<void> {
    const validatedId = documentSchema.shape.id.parse(id)
    await requestFromStore<undefined>('readwrite', (store) => store.delete(validatedId))
  },
}
