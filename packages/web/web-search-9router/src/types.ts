/**
 * Types for the 9Router-backed web search provider.
 * @module @deepseek-ai/dsh-web-search-9router/types
 */

export interface NineRouterSearchResultItem {
  title?: string | null
  url: string
  snippet?: string | null
  published_at?: string | null
  [key: string]: unknown
}

export interface NineRouterSearchAnswer {
  text?: string
  source?: string
  model?: string
  [key: string]: unknown
}

export interface NineRouterSearchResponse {
  provider?: string
  query?: string
  results?: NineRouterSearchResultItem[]
  answer?: NineRouterSearchAnswer | string | null
  error?: { message?: string; type?: string; code?: string }
  [key: string]: unknown
}

export interface NineRouterError {
  message?: string
  error?: string | { message?: string; type?: string; code?: string }
}
