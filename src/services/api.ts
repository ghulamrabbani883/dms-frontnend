import { z } from 'zod'

export const API_BASE_URL = 'https://apis.allsoft.co/api/documentManagement'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type ApiOptions = {
  method?: Method
  headers?: HeadersInit
  body?: unknown
}

const apiErrorSchema = z.object({
  message: z.string().optional(),
  error: z.string().optional(),
}).passthrough()

export const apiCall = async (
  url: string,
  { method = 'GET', headers = {}, body }: ApiOptions = {},
): Promise<unknown> => {
  const requestHeaders = new Headers(headers)
  let requestBody: BodyInit | undefined

  if (body instanceof FormData || body instanceof Blob) {
    requestBody = body
  } else if (body !== undefined && method !== 'GET') {
    requestHeaders.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      ...(requestBody !== undefined ? { body: requestBody } : {}),
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error. Please check your connection.', { cause: error })
    }
    throw error
  }

  const responseText = await response.text()
  let result: unknown
  if (responseText) {
    try {
      result = JSON.parse(responseText) as unknown
    } catch (error) {
      if (response.ok) throw new Error('The server returned an invalid JSON response.', { cause: error })
      result = responseText
    }
  }

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(result)
    const message = parsedError.success
      ? parsedError.data.message ?? parsedError.data.error
      : typeof result === 'string' ? result : undefined
    throw new Error(message || `Request failed with HTTP ${response.status}.`)
  }

  return result
}

export const getApiToken = () => {
  try {
    return localStorage.getItem('elevate-api-token')
  } catch (error) {
    console.warn('Unable to read the API token from local storage.', error)
    return null
  }
}

export const saveApiToken = (token: string) => {
  localStorage.setItem('elevate-api-token', token)
}

export const getApiUserId = () => {
  try {
    return localStorage.getItem('elevate-api-user-id')
  } catch (error) {
    console.warn('Unable to read the API user id from local storage.', error)
    return null
  }
}

export const saveApiUserId = (userId: string) => {
  localStorage.setItem('elevate-api-user-id', userId)
}

export const clearApiToken = () => {
  localStorage.removeItem('elevate-api-token')
  localStorage.removeItem('elevate-api-user-id')
}

export const authenticatedHeaders = () => {
  const token = getApiToken()
  if (!token) throw new Error('Sign in to continue.')
  return { token }
}
