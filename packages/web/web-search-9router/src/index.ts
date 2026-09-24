/**
 * `@deepseek-ai/dsh-web-search-9router`: registers a 9Router-backed `WebSearchProvider`
 * with `ctx.web`. A function/namespace plugin (NOT a default-export service):
 * a search provider does not own the `ctx.web` key — it registers INTO the
 * seam's provider registry.
 *
 * @module @deepseek-ai/dsh-web-search-9router
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-web'
import {
  NineRouterSearchProvider,
  NINEROUTER_DEFAULT_BASE_URL,
  NINEROUTER_DEFAULT_SEARCH_MODEL,
} from './provider.ts'
import type { NineRouterSearchProviderOptions } from './provider.ts'

export {
  NINEROUTER_DEFAULT_BASE_URL,
  NINEROUTER_DEFAULT_SEARCH_MODEL,
  NINEROUTER_SEARCH_PROVIDER_ID,
  NineRouterSearchProvider,
} from './provider.ts'
export type { NineRouterSearchProviderOptions } from './provider.ts'
export type { NineRouterSearchAnswer, NineRouterSearchResponse, NineRouterSearchResultItem } from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-9router'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Settings namespace carrying this provider's endpoint and key reference. */
export const WEB_SEARCH_NINEROUTER_SETTINGS_NAMESPACE = settingsNamespace('web-search-9router')

const DEFAULT_API_KEY_ENV = 'NINEROUTER_API_KEY'

/** Plugin config (all optional — `apply` fills defaults). */
export interface Config {
  /** Literal 9Router API key; prefer {@link apiKeyEnv} so no secret enters configuration files. */
  apiKey?: string
  /** Credential reference resolved for each search; defaults to `NINEROUTER_API_KEY`. */
  apiKeyEnv?: string
  /** Base URL for the 9Router OpenAI-compatible API; `/search` is appended. */
  baseURL?: string
  /** Search combo / model name. Defaults to `search-combo`. */
  model?: string
  /** Default result count when a request carries no `maxResults`. Omitted = none. */
  numResults?: number
}

export const Config: z<Config> = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  baseURL: z.string(),
  model: z.string().default(NINEROUTER_DEFAULT_SEARCH_MODEL),
  numResults: z.number().step(1).min(1),
})

/**
 * Resolve one search operation's options.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns options for one search.
 */
function resolveOptions(ctx: Context, config: Config): NineRouterSearchProviderOptions {
  const apiKeyEnv = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV)
  const literalApiKey = config.apiKey !== undefined && config.apiKey.length > 0
    ? config.apiKey
    : undefined
  return {
    ...literalApiKey === undefined ? {} : { apiKey: literalApiKey },
    resolveApiKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value
      const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    apiKeyEnv,
    baseURL: config.baseURL
      ?? launchEnvironmentOf(ctx).get('NINEROUTER_BASE_URL')?.value
      ?? NINEROUTER_DEFAULT_BASE_URL,
    model: config.model ?? NINEROUTER_DEFAULT_SEARCH_MODEL,
    ...config.numResults !== undefined ? { numResults: config.numResults } : {},
  }
}

/** Register the 9Router search provider with `ctx.web`. */
export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  installSettingsSection(ctx, WEB_SEARCH_NINEROUTER_SETTINGS_NAMESPACE, Config, config, {
    setSource: (source) => {
      current = source
    },
    onChange: () => {},
  })
  ctx.web.registerSearchProvider(new NineRouterSearchProvider(() => resolveOptions(ctx, current())))
}
