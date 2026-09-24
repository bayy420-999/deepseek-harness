# Agent Note: Keyboard avoidance for WebView shells

Status: implemented

## Problem

In an Android WebView the on-screen keyboard opens without resizing the layout
viewport unless the shell honors `interactive-widget=resizes-content` (older
WebViews ignore the meta entirely). The browser pans the whole page to keep the
focused composer visible, which scrolls the header and sidebar off-screen —
only the conversation scrollport should move.

## Decision

Track `window.visualViewport` and publish the covered height as
`--dsh-keyboard-inset` and the live visual-viewport height as
`--dsh-viewport-height` on the **root element** (`<html>`), flagging
`data-dsh-keyboard='open'`. `base.css` then shrinks the app mount (`body`,
`#root`) **to the visual-viewport height** and hides document overflow, so the
browser has nothing to pan: the sticky composer rides the reduced height above
the keyboard while the header and sidebar keep their place. A small offset
(address bar, browser chrome) is treated as no keyboard — the inset must exceed
a fixed ~150px.

The mount is sized straight from `--dsh-viewport-height` (the visual viewport),
not `calc(100dvh - inset)`: on the IME-active shell `innerHeight` and the ICB
can disagree and `dvh` is a large-viewport unit, so the subtraction over- or
under-shoots and leaves a gap between the composer and the keyboard. The visual
viewport is by definition the visible area, so its height sizes the app exactly.

The threshold must be a fixed pixel amount, not a ratio: on `resizes-visual`
engines (Chrome 108+ Android default) the layout viewport is the **unshrunken
height** and `dvh` derives from that same ICB, so a real 300px keyboard equals
`layoutHeight − visualViewport.height` yet falls under 40% of a tall (e.g.
800px) layout viewport — the ratio would never fire. Detection takes the larger
of `window.innerHeight` and the `documentElement` client height (the ICB), since
reporters disagree on whether `innerHeight` shrinks with the IME. Browser chrome
is below ~100px; a software keyboard is above ~200px, so ~150px separates them
independently of the layout height.

Publishing on the document root (not the conversation column root) is what
makes the fix reach the shell: the frame and sidebar are outside the
conversation column, so a column-scoped inset can only lift the composer, never
stop the whole-page pan that scrolls the shell chrome off-screen.

## Implementation

- `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx`:
  a `visualViewport` resize/scroll effect that sets/clears
  `--dsh-keyboard-inset`, `--dsh-viewport-height`, and the
  `data-dsh-keyboard` attribute on `document.documentElement` (all removed on
  unmount). Detection uses a fixed ~150px threshold against the larger of
  `innerHeight` and the `documentElement` client height.
- `packages/client/web/src/base.css`: inside the dvh `@supports` block,
  `html[data-dsh-keyboard='open']` hides document overflow and shrinks
  `body` / `#root` to `var(--dsh-viewport-height, 100dvh)` (the live visual
  viewport height), not a dvh subtraction.
- `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css`:
  `.scrollBody` no longer pads by the inset (the app-mount shrink positions the
  composer; padding would double-lift and add an empty scroll gap). While the
  keyboard is open, the composer's text height (`--dsh-composer-text-max-height`)
  is capped to a fraction of the reduced visual viewport
  (`min(336px, calc(var(--dsh-viewport-height, 100dvh) * 0.38))`, set on the
  seat via `html[data-dsh-keyboard='open']`), so a long draft scrolls inside a
  small window instead of filling the keyboard-open shell.
- `packages/client/ui-conversation/tests/skeleton.client.spec.tsx`: a
  `keyboard avoidance` describe block stubbing `visualViewport` (open, close,
  small-inset ignored, a fixed ~150px threshold independent of the layout
  height, scroll updates, unmount cleanup, no-visualViewport).
- `apps/web/index.html`: the viewport meta carries
  `interactive-widget=resizes-content` so modern shells resize the layout
  viewport natively; the JS inset covers shells that do not.

## Alternatives considered

### Pad the conversation scroll body only (first shipped version)

Rejected: a column-scoped inset lifts the sticky composer but leaves the frame
at `100dvh`, so the browser still pans the whole page and the header and sidebar
scroll off-screen — the exact symptom the note existed to fix. The inset must
reach the shell to constrain the app's height.

## Consequences

- The composer stays above the keyboard and, unlike the scroll-body-padding
  version, the header and sidebar stop scrolling because the app mount fills
  the visual viewport and the document is not pannable. Sizing the mount to the
  live visual-viewport height (not a `dvh` subtraction) keeps the composer flush
  against the keyboard with no dead gap.
- The transcript still scrolls in its own `overflow-y: auto` scrollport.
- On a shell that honors `interactive-widget=resizes-content`, the layout
  viewport resizes natively, so the inset computes to zero and the JS shrink is
  inert.
