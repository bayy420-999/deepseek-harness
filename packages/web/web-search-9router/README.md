# @deepseek-ai/dsh-web-search-9router

A 9Router-backed `WebSearchProvider` for the harness web capability seam (`ctx.web`). It calls 9Router's `POST /v1/search` endpoint and maps `results[]` and `answer` into the seam's normalized `WebSearchResult`.

This is an **implementation** package: it registers a provider into `ctx.web`, it does not own the `ctx.web` key and it does not register a model-facing tool (that is `@deepseek-ai/dsh-tool-web`).

## Config

| Key | Default | Meaning |
|---|---|---|
| `apiKey` | (unset) | Literal 9Router API key. Prefer `apiKeyEnv`. |
| `apiKeyEnv` | `NINEROUTER_API_KEY` | Credential reference resolved for each search. |
| `baseURL` | `http://127.0.0.1:20128/v1` | Endpoint base; `/search` is appended. |
| `model` | `search-combo` | 9Router search combo or model name. |
| `numResults` | (unset) | Default result count when a request carries no `maxResults`. |

## Model Experience

Indirectly, through [`dsh-tool-web`](../tool-web/README.md), which retains this provider's `maxResults`-bounded URLs, titles, snippets, and publication dates or its error wrappers.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- **Provider fallback** — 9Router internally handles provider fallback within configured search combos.
