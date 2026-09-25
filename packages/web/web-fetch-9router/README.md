# @deepseek-ai/dsh-web-fetch-9router

A 9Router-backed `WebFetchProvider` for the harness web capability seam (`ctx.web`). It calls 9Router's `POST /v1/web/fetch` endpoint and maps markdown extraction into the seam's normalized `WebFetchResult`.

This is an **implementation** package: it registers a provider into `ctx.web`, it does not own the `ctx.web` key and it does not register a model-facing tool (that is `@deepseek-ai/dsh-tool-web`).

## Config

| Key | Default | Meaning |
|---|---|---|
| `apiKey` | (unset) | Literal 9Router API key. Prefer `apiKeyEnv`. |
| `apiKeyEnv` | `NINEROUTER_API_KEY` | Credential reference resolved for each fetch. |
| `baseURL` | `http://127.0.0.1:20128/v1` | Endpoint base; `/web/fetch` is appended. |
| `model` | `fetch-combo` | 9Router fetch combo or model name. |

## Model Experience

Indirectly, through [`dsh-tool-web`](../tool-web/README.md), which retains this provider's extracted content or its error wrappers.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- **Markdown extraction body** — 9Router returns markdown content directly; HTML raw response body is decoded into text format.
