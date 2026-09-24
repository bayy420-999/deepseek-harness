/**
 * `NineRouterSearchProvider`: a `WebSearchProvider` backed by the 9Router search API (`POST /v1/search`).
 * @module @deepseek-ai/dsh-web-search-9router/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import type { NineRouterError, NineRouterSearchResponse, NineRouterSearchResultItem } from './types.ts'

/** Stable id this provider registers under. */
export const NINEROUTER_SEARCH_PROVIDER_ID = '9router'

/** Default 9Router base URL. */
export const NINEROUTER_DEFAULT_BASE_URL = 'http://127.0.0.1:20128/v1'

/** Default 9Router search combo model. */
export const NINEROUTER_DEFAULT_SEARCH_MODEL = 'search-combo'

/** Attribution header sent on every request. */
const USER_AGENT = 'deepseek-harness/0.0.1'

/** Resolved provider options. */
export interface NineRouterSearchProviderOptions {
  /** Literal API key; when present it wins over {@link resolveApiKey}. */
  apiKey?: string
  /** Resolve the API key for one search operation. */
  resolveApiKey?: () => Promise<string | undefined>
  /** Credential reference named in diagnostics. */
  apiKeyEnv?: CredentialRef
  /** Endpoint base; `/search` is appended. */
  baseURL: string
  /** Search model / combo name. */
  model: string
  /** Default result count when a request carries no `maxResults`. */
  numResults?: number
}

/**
 * Map one 9Router search result entry to a normalized source.
 * @param result - one entry in results[].
 * @returns the normalized source, or undefined if invalid.
 */
export function mapNineRouterSearchResult(result: NineRouterSearchResultItem): WebSearchSource | undefined {
  if (result == null || typeof result.url !== 'string' || result.url.trim().length === 0) {
    return undefined
  }
  const source: WebSearchSource = {
    url: result.url.trim(),
    ...result.title != null && result.title.trim().length > 0 ? { title: result.title.trim() } : {},
    ...result.snippet != null && result.snippet.trim().length > 0 ? { snippet: result.snippet.trim() } : {},
    ...result.published_at != null && result.published_at.trim().length > 0 ? { publishedAt: result.published_at.trim() } : {},
  }
  return source
}

/**
 * Map a 9Router search response envelope to a normalized search result.
 * @param response - the parsed search response body.
 * @returns the normalized result.
 */
export function mapNineRouterSearchResponse(response: NineRouterSearchResponse): WebSearchResult {
  const sources = (response.results ?? [])
    .map(mapNineRouterSearchResult)
    .filter((source): source is WebSearchSource => source !== undefined)

  let content: string | undefined
  if (response.answer != null) {
    if (typeof response.answer === 'string' && response.answer.trim().length > 0) {
      content = response.answer.trim()
    } else if (typeof response.answer === 'object' && typeof response.answer.text === 'string' && response.answer.text.trim().length > 0) {
      content = response.answer.text.trim()
    }
  }

  return {
    ...content !== undefined ? { content } : {},
    sources,
    truncated: false,
  }
}

/** The 9Router-backed search provider; HTTP redirects fail as `WEB_PROVIDER_ERROR`. */
export class NineRouterSearchProvider implements WebSearchProvider {
  readonly id = NINEROUTER_SEARCH_PROVIDER_ID

  constructor(private readonly rawOptions: NineRouterSearchProviderOptions | (() => NineRouterSearchProviderOptions)) {}

  private get options(): NineRouterSearchProviderOptions {
    return typeof this.rawOptions === 'function' ? this.rawOptions() : this.rawOptions
  }

  available(): boolean {
    const opts = this.options
    return (opts.apiKey !== undefined && opts.apiKey.length > 0 || opts.resolveApiKey !== undefined)
      && isValidBaseUrl(opts.baseURL)
      && opts.model.length > 0
      && (opts.numResults === undefined || isPositiveInteger(opts.numResults))
  }

  private async apiKey(signal?: AbortSignal): Promise<string> {
    const opts = this.options
    if (opts.apiKey !== undefined && opts.apiKey.length > 0) {
      return opts.apiKey
    }
    if (opts.resolveApiKey !== undefined) {
      const resolved = await opts.resolveApiKey()
      if (signal?.aborted) throw new WebError('9Router search aborted', 'WEB_ABORTED')
      if (resolved !== undefined && resolved.length > 0) return resolved
    }
    throw new WebError('Missing 9Router API key for web search', 'WEB_PROVIDER_ERROR')
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    if (signal?.aborted) throw new WebError('9Router search aborted', 'WEB_ABORTED')

    const opts = this.options
    const apiKey = await this.apiKey(signal)
    const numResults = request.maxResults ?? opts.numResults
    const endpoint = `${opts.baseURL.replace(/\/+$/, '')}/search`

    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'accept': 'application/json',
          'user-agent': USER_AGENT,
        },
        body: JSON.stringify({
          query: request.query,
          model: opts.model,
          ...numResults !== undefined ? { max_results: numResults } : {},
        }),
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAbortError(error) || signal?.aborted) {
        throw new WebError('9Router search aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(`9Router search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      const status = response.status
      let message = `9Router API error (HTTP ${status})`
      try {
        const parsed = await response.json() as NineRouterError
        const detail = typeof parsed.error === 'string'
          ? parsed.error
          : parsed.error?.message ?? parsed.message
        if (detail !== undefined && detail.length > 0) message = detail
      } catch (error: unknown) {
        if (isAbortError(error) || signal?.aborted) {
          throw new WebError('9Router search aborted', 'WEB_ABORTED', { cause: error })
        }
      }
      throw new WebError(message, 'WEB_PROVIDER_ERROR')
    }

    try {
      const payload = await response.json() as NineRouterSearchResponse
      return mapNineRouterSearchResponse(payload)
    } catch (error: unknown) {
      if (isAbortError(error) || signal?.aborted) {
        throw new WebError('9Router search aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(`9Router returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
}

/** True when `baseURL` parses as an absolute URL. */
function isValidBaseUrl(baseURL: string): boolean {
  return URL.canParse(baseURL)
}

/** True for a positive whole number. */
function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
