/**
 * Types for the 9Router-backed web fetch provider.
 * @module @deepseek-ai/dsh-web-fetch-9router/types
 */

export interface NineRouterFetchContent {
  format?: string
  text?: string
  length?: number
  [key: string]: unknown
}

export interface NineRouterFetchResponse {
  provider?: string
  url?: string
  title?: string | null
  content?: NineRouterFetchContent
  error?: { message?: string; type?: string; code?: string }
  [key: string]: unknown
}

export interface NineRouterError {
  message?: string
  error?: string | { message?: string; type?: string; code?: string }
}
