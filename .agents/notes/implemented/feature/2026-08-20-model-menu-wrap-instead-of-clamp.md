# Agent Note: Model menu rows wrap instead of clamping text

Status: implemented

English | [中文](2026-08-20-model-menu-wrap-instead-of-clamp.zh.md)

## Problem

The composer model menu (`packages/client/ui-model-selection`, the `conversation.input.model` seat's two-level Model/Effort dropdown) clamped every text row to one line with an ellipsis inside a 240px-wide menu: a long model name lost its tail, and the per-model description — the row's main differentiator — was cut to a few characters. The root pane's value cell could also grow until the left label lost its room. The trigger chip in the composer row shares its width with the effort suffix, so on narrow cards the model name ellipsized first.

Widening the menu to 320px then exposed a positional failure on phones: the menu anchors `right: 0` to the trigger, which sits mid-row on narrow composer cards (the send button claims the row's right edge), so the menu's left edge ran past the viewport — at a 360px viewport the trigger's right edge was at x=281 while the menu was 330px wide, leaving the menu starting at x=-49. Only the right-hand slice of the model name ("…seek") stayed visible, and the surplus width read as blank space on the menu's right. Clamping against the viewport alone was still wrong: the menu lives inside the composer seat, whose scroll body clips horizontally (`overflow-x: hidden`) at a box narrower than the viewport — at 360px the seat spans x=56..360 (304px), so a 330px menu was cut at the seat's left edge no matter where the viewport clamp put it, and the first characters ("Deep…" of the name) stayed hidden even after the clamp pulled the menu on-screen.

## Decision

The menu never truncates its rows:

- The menu widens from `min(240px, calc(100vw - 32px))` to `min(320px, calc(100vw - 32px))`; the width cap bounds it to the card, and a `useLayoutEffect` placement pass (the same measure-and-clamp pattern as the Menu primitive's portal placement in `ui-primitives`) overrides the CSS `right: 0` anchor with a measured `left` while open. The clamp box is the nearest ancestor with a non-visible horizontal overflow — the composer seat's scroll body on phones, the viewport when nothing clips (jsdom tests and desktop) — so both edges stay 12px inside that box, not just the viewport. When the 320px design width cannot fit the clamp box (a 360px seat is ~304px), the pass also caps the menu's inline width (with `box-sizing: border-box`) to the box minus the two margins, so no part of the menu is ever clipped by the seat. The pass re-places on `resize` while the menu is open; when the clamp is not needed it resolves to the same right-aligned position the CSS would have produced.
- `.modelName` and `.description` drop `white-space: nowrap` / `text-overflow: ellipsis` and wrap freely (`overflow-wrap: break-word`). A long row grows the option; the menu's existing `max-height` cap turns the surplus into scroll, so nothing is lost.
- The root pane's `.cellValue` keeps its single-line ellipsis (that row is fixed-height chrome) but caps at `max-width: 50%` so the left label and chevron keep their room, and the model cell now carries the full value in its `title`.
- Below a 460px composer card (the InputBar tool row's anonymous inline-size container, the same query PermissionSelect uses) the trigger's effort suffix hides, yielding its width to the model name — the chip's identity. The effort stays visible in the menu and in the trigger's `aria-label`/`title`.

The trigger chip has no fixed width cap: it sizes to its content, the tools group yields first when the composer row tightens (its own container queries collapse the sibling chips), and the trigger's ellipsis applies only as the row's last resort — the chip's `title` carries the full label either way. The menu is the surface that must show complete text.

## Alternatives considered

**Two-line clamp (`-webkit-line-clamp: 2`) on descriptions.** Rejected: clamping at any line count still hides text the menu exists to show; the height cap plus scroll already bounds long lists, and the row wrap is only as tall as the content.

**Middle truncation for model names.** Rejected: display names, not machine ids, are shown, so the tail (which carries the distinguishing part) must never be cut; wrapping is strictly more informative and needs no measurement.

**Icon-only trigger on narrow cards (collapse the whole chip).** Rejected: unlike the permission chip, the model seat has no glyph identity — the name is the whole affordance, so it must keep its text and instead shed the effort suffix.

**Keep the 220px trigger cap.** Rejected: the cap clamped the model name even when the row had free room; dropping it lets the chip size naturally while the tools group's container queries absorb the squeeze first.

## Consequences

Rows in the model/effort lists are content-sized instead of fixed-height, which the sticky group titles and the scrollable `.groups` already tolerate. The open menu gains inline styles while the clamp is active (an overridden `left`/`right`, plus a capped `width` with `box-sizing: border-box` when the seat is too narrow) and a `resize` listener that dies with the open state. No locale strings, slot contracts, or store data changed; the DOM additions are the root-pane model cell's `title` and the menu's inline position and width. The same wrap-instead-of-clamp pattern is the reference for any other menu row that currently truncates (the trajectory table keeps its horizontal-scroll contract, which is a different reading mode).

## Testing

`packages/client/ui-model-selection/tests/model-select.client.spec.tsx` pins the menu's user-visible behavior, including a placement spec that stubs the trigger rect and viewport width (the same technique as the tooltip clamp spec in `ui-primitives`): with the trigger mid-row at 360px the open menu's inline `left` keeps both edges inside the clamp box, and a `resize` re-place releases the clamp once the trigger sits clear of the edge. A second spec models the phone seat by giving the root's parent a real `overflow-x: hidden` style and a narrower rect, asserting the menu shrinks to the seat minus margins (`box-sizing: border-box`) and re-sizes on reflow. The assembled-browser check for visible UI changes remains `DSH_SNAPSHOT=replay pnpm run test:web` in CI; it cannot run on the Android/Termux development host because Playwright ships no browser build for that platform.
