import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import { NineRouterSearchProvider, NINEROUTER_SEARCH_PROVIDER_ID } from '../src/provider.ts'
import * as nineRouterSearchPlugin from '../src/index.ts'
import { mapNineRouterSearchResponse, mapNineRouterSearchResult } from '../src/provider.ts'

const options = {
  apiKey: 'test-key',
  baseURL: 'http://127.0.0.1:20128/v1',
  model: 'search-combo',
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('9Router search result mapping', () => {
  it('maps a full result entry', () => {
    expect(mapNineRouterSearchResult({
      url: 'https://example.com',
      title: 'Example',
      snippet: 'A snippet',
      published_at: '2026-01-01',
    })).toEqual({
      url: 'https://example.com',
      title: 'Example',
      snippet: 'A snippet',
      publishedAt: '2026-01-01',
    })
  })

  it('drops entries without a url', () => {
    expect(mapNineRouterSearchResult({ url: '' } as any)).toBeUndefined()
    expect(mapNineRouterSearchResult({} as any)).toBeUndefined()
  })

  it('maps a response with answer and results', () => {
    const res = mapNineRouterSearchResponse({
      provider: 'exa',
      query: 'test',
      answer: { text: 'The answer is 42.' },
      results: [
        { url: 'https://a.test', title: 'A', snippet: 'one' },
        { url: 'https://b.test', snippet: 'two' },
      ],
    })
    expect(res).toEqual({
      content: 'The answer is 42.',
      sources: [
        { url: 'https://a.test', title: 'A', snippet: 'one' },
        { url: 'https://b.test', snippet: 'two' },
      ],
      truncated: false,
    })
  })

  it('handles string answer and empty results', () => {
    const res = mapNineRouterSearchResponse({
      provider: 'antigravity',
      query: 'test',
      answer: 'Plain string answer',
      results: [],
    })
    expect(res).toEqual({
      content: 'Plain string answer',
      sources: [],
      truncated: false,
    })
  })
})

describe('NineRouterSearchProvider availability', () => {
  it('is unavailable without a key or resolver', () => {
    expect(new NineRouterSearchProvider({ ...options, apiKey: '' }).available()).toBe(false)
  })

  it('is available with a key', () => {
    expect(new NineRouterSearchProvider(options).available()).toBe(true)
  })

  it('is available with resolveApiKey', () => {
    expect(new NineRouterSearchProvider({ ...options, apiKey: '', resolveApiKey: async () => 'key' }).available()).toBe(true)
  })
})

describe('NineRouterSearchProvider search execution', () => {
  it('sends POST /search with query, model, max_results', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [{ url: 'https://a.test' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new NineRouterSearchProvider(options)
    const result = await provider.search({ query: 'hello', maxResults: 3 })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:20128/v1/search')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer test-key')
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'hello',
      model: 'search-combo',
      max_results: 3,
    })
    expect(result.sources).toHaveLength(1)
  })

  it('handles API errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'Invalid API key' } }, { status: 401 })))

    const provider = new NineRouterSearchProvider(options)
    await expect(provider.search({ query: 'q' })).rejects.toThrow('Invalid API key')
  })
})

describe('web-search-9router plugin registration', () => {
  it('registers provider into ctx.web (HMR-safe)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: [] })))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: NINEROUTER_SEARCH_PROVIDER_ID })
    const fiber = await ctx.plugin(nineRouterSearchPlugin, { apiKey: 'key' })

    await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({ sources: [] })
    await fiber.dispose()
    await expect(ctx.web.search({ query: 'q' })).rejects.toThrow()
  })
})
