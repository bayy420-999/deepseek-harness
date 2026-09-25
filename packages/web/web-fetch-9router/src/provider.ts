/** 9Router-backed `WebFetchProvider` over `POST /v1/web/fetch`. */

import { WebError } from '@deepseek-ai/dsh-web'
import type { WebFetchProvider, WebFetchRequest, WebFetchResult } from '@deepseek-ai/dsh-web'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import type { NineRouterError, NineRouterFetchResponse } from './types.ts'

export const NINEROUTER_FETCH_PROVIDER_ID = '9router'
export const NINEROUTER_DEFAULT_BASE_URL = 'http://127.0.0.1:20128/v1'
export const NINEROUTER_DEFAULT_FETCH_MODEL = 'fetch-combo'
const USER_AGENT = 'deepseek-harness/0.0.1'

export interface NineRouterFetchProviderOptions {
  apiKey?: string
  resolveApiKey?: () => Promise<string | undefined>
  apiKeyEnv?: CredentialRef
  baseURL: string
  model: string
}

/** Map 9Router's markdown extraction into portable text response. */
export function mapNineRouterFetchResponse(response: NineRouterFetchResponse, requestedUrl: string): WebFetchResult {
  const content = response.content?.text
  if (typeof content !== 'string') throw new WebError('9Router returned no fetch content', 'WEB_PROVIDER_ERROR')
  return {
    url: typeof response.url === 'string' && response.url.length > 0 ? response.url : requestedUrl,
    statusCode: 200,
    body: { kind: 'text', content },
    truncated: false,
  }
}

/** The 9Router-backed fetch provider; HTTP redirects fail as `WEB_PROVIDER_ERROR`. */
export class NineRouterFetchProvider implements WebFetchProvider {
  readonly id = NINEROUTER_FETCH_PROVIDER_ID
  constructor(private readonly rawOptions: NineRouterFetchProviderOptions | (() => NineRouterFetchProviderOptions)) {}
  private get options(): NineRouterFetchProviderOptions { return typeof this.rawOptions === 'function' ? this.rawOptions() : this.rawOptions }
  available(): boolean {
    const opts = this.options
    return (opts.apiKey !== undefined && opts.apiKey.length > 0 || opts.resolveApiKey !== undefined) && URL.canParse(opts.baseURL) && opts.model.length > 0
  }
  private async apiKey(signal?: AbortSignal): Promise<string> {
    const opts = this.options
    if (opts.apiKey !== undefined && opts.apiKey.length > 0) return opts.apiKey
    const resolved = await opts.resolveApiKey?.()
    if (signal?.aborted) throw new WebError('9Router fetch aborted', 'WEB_ABORTED')
    if (resolved !== undefined && resolved.length > 0) return resolved
    throw new WebError('Missing 9Router API key for web fetch', 'WEB_PROVIDER_ERROR')
  }
  async fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    if (signal?.aborted) throw new WebError('9Router fetch aborted', 'WEB_ABORTED')
    const opts = this.options
    const apiKey = await this.apiKey(signal)
    let response: Response
    try {
      response = await fetch(`${opts.baseURL.replace(/\/+$/, '')}/web/fetch`, {
        method: 'POST', redirect: 'error',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json', 'user-agent': USER_AGENT },
        body: JSON.stringify({ url: request.url, model: opts.model }),
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAbortError(error) || signal?.aborted) throw new WebError('9Router fetch aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(`9Router fetch request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
    if (!response.ok) {
      let message = `9Router API error (HTTP ${response.status})`
      try {
        const parsed = await response.json() as NineRouterError
        const detail = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message ?? parsed.message
        if (detail !== undefined && detail.length > 0) message = detail
      } catch (error: unknown) {
        if (isAbortError(error) || signal?.aborted) throw new WebError('9Router fetch aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(message, 'WEB_PROVIDER_ERROR')
    }
    try {
      return mapNineRouterFetchResponse(await response.json() as NineRouterFetchResponse, request.url)
    } catch (error: unknown) {
      if (error instanceof WebError) throw error
      if (isAbortError(error) || signal?.aborted) throw new WebError('9Router fetch aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(`9Router returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
}
function isAbortError(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError' }
