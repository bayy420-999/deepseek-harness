# Agent Note: Merge consecutive user messages on the image path

Status: implemented

## Problem

The harness emits the user's message and the runtime-context snapshot as two
consecutive `user/message` events whenever a request carries image content (the
runtime-context plugin appends its user block right after the composer's). The
pi-ai adapter converted each into its own `{ role: 'user' }` message, so the
request carried a run of consecutive user turns with an image in the first and
text in the second.

Providers handle that run differently. The Gemini/Claude endpoints the
antigravity router proxies accept consecutive user turns verbatim, so image
input worked there. The b-ai `deepseek-v4-flash-vision-exp` endpoint (and, per
the same failure, other OpenAI-completions vision models) only attends to the
**last** user message in a run of user turns and silently drops images in the
earlier ones. A single-message request proves the model can see the image; the
two-message request reproducibly returns "I don't see an actual screenshot
attached." This is a model-side defect, not a serialization one: the exact
harness payload reproduced against `api.b.ai` directly.

## Decision

`toPiContextWithImages` folds a run of consecutive `user` messages into one
`user` message before returning the pi-ai context. The adapter resolves the
attachment service only when the request contains an image, so image requests
always take this path; text-only requests take `textOnlyContext`, which is left
unchanged. Consecutive user turns with no assistant turn between them are one
user input semantically, and the merge is lossless:

- string + string → concatenated string;
- string + array → the string becomes a `text` content block and the arrays
  concatenate;
- array + array → blocks concatenate in order.

The merge happens after per-message conversion, so image blocks, base64 data,
and tool-result ordering are unaffected. A user message followed by an
assistant or `toolResult` message is never merged. The adapter's existing
`containsImage && !model.input.includes('image')` gate still rejects truly
text-only models before conversion.

## Alternatives considered

### Merge on the text-only path too, for symmetry

Rejected: `textOnlyContext` folds in-history system blocks into a user message,
and merging a subsequent user message into that fold concatenates the two
without a separator — a behavior change with no fix value (there is no image to
drop on the text-only path) and no consumer that needs it. Scoping the merge to
the image path keeps the fix minimal.

### Merge at the harness layer instead

Hoist the merge into `deriveMessages`/`buildRequest` so every consumer sees one
user message. Rejected: the harness must not flatten a provider-agnostic fact
into a UI-specific assumption — the runtime-context block is deliberately a
separate user turn for providers (like Gemini/Claude) that render consecutive
turns distinctly, and the session log must stay reconstructable. The pi-ai
adapter is the boundary that knows the wire format the provider will reject.

### Teach pi-ai itself to merge

Modify `@earendil-works/pi-ai`'s `convertMessages`. Rejected: pi-ai is vendored
and unrescoped; the harness adapter owns the merge so a pi-ai upgrade cannot
silently drop or re-add the behavior.

### Rely on pi-ai's `downgradeUnsupportedImages`

The adapter's input gate throws `UNSUPPORTED_CONTENT` before pi-ai's silent
placeholder path runs, so the downgrade is unreachable here anyway — and it
would drop the image rather than fix the two-message case.

## Consequences

- Image-bearing requests to `deepseek-v4-flash-vision-exp` now carry the image
  and every following user turn's text in one `user` message, so the model
  attends to the image.
- Replays recompute the same merge, so they stay deterministic.
- Consecutive user turns with no assistant between them that were previously
  separate (and harmless) are now one turn on the wire; the model-visible
  content is unchanged because there was no assistant response in between.
- The text-only path is untouched, preserving the existing system-fold
  behavior covered by the `convert` spec.
