/**
 * @deepseek-ai/dsh-host-frontend-static — SPA dist server over the webserver
 * fallback seat: serves the built frontend directory with explicit index
 * entry points. A readable index renders at the dist root and configured index
 * path; missing paths return 404, traversal outside the dist root is 403,
 * unknown extensions ship as octet-stream, and non-GET/HEAD is 405. Every
 * index response first passes Connection's browser authentication, then the
 * webserver's index render (structured injection rows, then raw taps).
 * Non-index assets stay public. The dist location is workspace knowledge of
 * the composing application, so `distIndex` is typically supplied through a
 * `!!js` expression, never hardcoded by a deployment.
 * @module @deepseek-ai/dsh-host-frontend-static
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress as brotliCompressCallback, gzip as gzipCallback } from 'node:zlib'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Stable Cordis plugin name. */
export const name = 'frontend-static'

/** Services required before the authenticated fallback seat can be claimed. */
export const inject = ['webServer', 'connection']

/** Plugin config: the dist anchor. */
export interface Config {
  /** Absolute path of index.html inside the dist root. */
  distIndex: string
}

export const Config: z<Config> = z.object({
  distIndex: z.string().required(),
})

const HTML_MIME = 'text/html; charset=utf-8'

const MIME: Record<string, string> = {
  '.html': HTML_MIME,
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  // The packed VFS image. Served as its own bytes, never as a Content-Encoding:
  // the worker inflates the body itself, and a transport-level encoding would
  // leave it inflating an already-decoded archive.
  '.gz': 'application/gzip',
}

const gzip = promisify(gzipCallback)
const brotliCompress = promisify(brotliCompressCallback)

const STATIC_MISS_CODES: ReadonlySet<string | undefined> = new Set([
  'ENOENT',
  'EISDIR',
  'ENOTDIR',
])

/** Extensions worth compressing over the wire. */
const COMPRESSIBLE: ReadonlySet<string> = new Set([
  '.html', '.js', '.css', '.svg', '.json', '.map', '.webmanifest',
])

/** Vite hashed assets live under `/assets/` (see apps/web/vite.config.ts output layout). */
const HASHED_PREFIX = '/assets/'

/** One year, the standard immutable cache lifetime for content-hashed assets. */
const IMMUTABLE_MAX_AGE = 31536000

/** Upper bound on server-side compressed copies retained (path + mtime keyed). */
const COMPRESSED_CACHE_LIMIT = 64

/** Bounded compression cache: a rebuild (new mtime) naturally evicts its own entry. */
const compressedCache = new Map<string, { encoding: 'gzip' | 'br'; body: Buffer }>()

/**
 * Pick the strongest encoding the client accepts, or `undefined` for identity.
 * @param header - the raw `Accept-Encoding` request header value.
 * @returns `'br'` when brotli is acceptable, else `'gzip'` when gzip is, else
 * `undefined` (serve identity). Browsers send both; ordering here is brotli
 * over gzip, matching the ~15-20% size advantage measured on the dist bundles.
 */
function pickEncoding(header: string | undefined): 'gzip' | 'br' | undefined {
  if (header === undefined) return undefined
  const encodings = header.toLowerCase()
  if (encodings.includes('br')) return 'br'
  if (encodings.includes('gzip')) return 'gzip'
  return undefined
}

/** Compress a buffer in the negotiated encoding. */
async function compress(body: Buffer, encoding: 'gzip' | 'br'): Promise<Buffer> {
  return encoding === 'br' ? brotliCompress(body) : gzip(body)
}

/**
 * Cache header for one static response. Vite hashed assets (`/assets/**`) are
 * content-addressed — a new build renames them — so they are immutable for a
 * year; everything else (index.html, favicon, manifest, SPA fallbacks) carries
 * `no-cache` so every reload revalidates through the shell's boot-manifest
 * injection.
 * @param pathname - decoded URL pathname of the request.
 * @returns the `Cache-Control` value.
 */
function cacheControl(pathname: string): string {
  return pathname.startsWith(HASHED_PREFIX)
    ? `public, max-age=${IMMUTABLE_MAX_AGE}, immutable`
    : 'no-cache'
}

/**
 * Serve one GET/HEAD static request from the dist root.
 * @param pathname - decoded URL pathname of the request.
 * @param req - the node:http request (encoding negotiation).
 * @param res - the node:http response to write.
 * @param distRoot - absolute dist root directory (resolved by the caller).
 * @param distIndex - absolute path of index.html inside distRoot.
 * @param authorizeIndex - authenticates an index response before its bytes are read.
 * @param renderIndex - produces the index.html body (structured injection
 * rendering) for the dist root and configured index path.
 */
export async function serveStatic(
  pathname: string, req: IncomingMessage, res: ServerResponse, distRoot: string, distIndex: string,
  authorizeIndex: () => boolean,
  renderIndex: () => Promise<string>,
): Promise<void> {
  const target = resolve(normalize(join(distRoot, pathname)))
  // Traversal rejection: the target must be distRoot itself (`/`) or stay under
  // it. `sep`, not '/': resolve() emits backslash paths on Windows, where a '/'
  // suffix would reject every legitimate subpath as traversal.
  if (target !== distRoot && !target.startsWith(distRoot + sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  let body: string | Buffer
  let type: string
  let cacheControlHeader = 'no-cache'
  try {
    if (target === distRoot || target === distIndex) {
      if (!authorizeIndex()) return
      body = await renderIndex()
      type = HTML_MIME
    } else {
      body = await readFile(target)
      const ext = extname(target)
      type = MIME[ext] ?? 'application/octet-stream'
      cacheControlHeader = cacheControl(pathname)
      const encoding = COMPRESSIBLE.has(ext) ? pickEncoding(req.headers['accept-encoding']) : undefined
      if (encoding !== undefined && typeof body !== 'string') {
        const { mtimeMs } = await stat(target)
        // Cache per (file, mtime, encoding): a gzip-only client must never be
        // handed the brotli copy cached for another client.
        const key = `${target}:${mtimeMs}:${encoding}`
        let cached = compressedCache.get(key)
        if (cached === undefined) {
          cached = { encoding, body: await compress(body, encoding) }
          if (compressedCache.size >= COMPRESSED_CACHE_LIMIT) {
            const oldest = compressedCache.keys().next().value
            if (oldest !== undefined) compressedCache.delete(oldest)
          }
          compressedCache.set(key, cached)
        }
        res.writeHead(200, {
          'content-type': type,
          'content-encoding': cached.encoding,
          'vary': 'accept-encoding',
          'cache-control': cacheControlHeader,
        })
        res.end(cached.body)
        return
      }
    }
  } catch (error) {
    // Only absent or non-file targets are 404; other filesystem failures reach
    // the webserver's request-failure handling.
    if (!STATIC_MISS_CODES.has((error as NodeJS.ErrnoException).code)) throw error
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': type, 'cache-control': cacheControlHeader })
  res.end(body)
}

/**
 * Claim the webserver fallback seat and serve the dist.
 * @param ctx - plugin context carrying the webServer service.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  const distIndex = config.distIndex
  const distRoot = dirname(distIndex)
  // Insert after all index transforms so the base precedes every resource reference.
  const renderIndex = async (): Promise<string> => {
    const body = ctx.webServer.renderIndex(await readFile(distIndex, 'utf8'))
    return body.replace(/<head(?:\s[^>]*)?>/i, open => `${open}<base href="./">`)
  }
  ctx.effect(() => ctx.webServer.registerFallback(async (req, res) => {
    // Non-GET/HEAD without a matching named route is 405 (fallback-only
    // semantics: named routes own their method handling).
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405)
      res.end()
      return
    }
    /* v8 ignore next -- node:http always sets url on server requests */
    const rawPath = new URL(req.url ?? '/', 'http://x').pathname
    await serveStatic(
      decodeURIComponent(rawPath),
      req,
      res,
      distRoot,
      distIndex,
      () => ctx.connection.authorizeIndex(req, res),
      renderIndex,
    )
  }), 'frontend-static: fallback seat')
}
