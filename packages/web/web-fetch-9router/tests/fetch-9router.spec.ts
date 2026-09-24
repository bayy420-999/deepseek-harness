import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import { NineRouterFetchProvider, NINEROUTER_FETCH_PROVIDER_ID } from '../src/provider.ts'
import * as nineRouterFetchPlugin from '../src/index.ts'
import { mapNineRouterFetchResponse } from '../src/provider.ts'

const options = {
  apiKey: 'test-key',
  baseURL: 'http://127.0.0.1:20128/v1',
  model: 'fetch-combo',
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('9Router fetch response mapping', () => {
  it('maps a full fetch response to WebFetchResult', () => {
    const res = mapNineRouterFetchResponse({
      provider: 'exa',
      url: 'https://example.com',
      title: 'Example',
      content: { format: 'markdown', text: 'Page body here', length: 14 },
    }, 'https://example.com')

    expect(res).toEqual({
      url: 'https://example.com',
      statusCode: 200,
      body: { kind: 'text', content: 'Page body here' },
      truncated: false,
    })
  })

  it('throws on missing content', () => {
    expect(() => mapNineRouterFetchResponse({} as any, 'https://example.com')).toThrow()
  })
})

describe('NineRouterFetchProvider availability', () => {
  it('is unavailable without a key or resolver', () => {
    expect(new NineRouterFetchProvider({ ...options, apiKey: '' }).available()).toBe(false)
  })

  it('is available with a key', () => {
    expect(new NineRouterFetchProvider(options).available()).toBe(true)
  })

  it('is available with resolveApiKey', () => {
    expect(new NineRouterFetchProvider({ ...options, apiKey: '', resolveApiKey: async () => 'key' }).available()).toBe(true)
  })
})

describe('NineRouterFetchProvider fetch execution', () => {
  it('sends POST /web/fetch with url and model', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      url: 'https://example.com',
      content: { format: 'markdown', text: '# Hello' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new NineRouterFetchProvider(options)
    const result = await provider.fetch({ url: 'https://example.com' })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:20128/v1/web/fetch')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer test-key')
    expect(JSON.parse(init.body as string)).toEqual({
      url: 'https://example.com',
      model: 'fetch-combo',
    })
    expect(result.body.content).toBe('# Hello')
  })
})

describe('web-fetch-9router plugin registration', () => {
  it('registers provider into ctx.web (HMR-safe)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      url: 'https://example.com',
      content: { text: 'content' },
    })))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { fetchProvider: NINEROUTER_FETCH_PROVIDER_ID })
    const fiber = await ctx.plugin(nineRouterFetchPlugin, { apiKey: 'key' })

    await expect(ctx.web.fetch({ url: 'https://example.com' })).resolves.toMatchObject({
      body: { content: 'content' },
    })
    await fiber.dispose()
    await expect(ctx.web.fetch({ url: 'https://example.com' })).rejects.toThrow()
  })
})
