# Agent Note: Header breadcrumbs keep the current session title unclamped

Status: implemented

English | [中文](2026-08-20-header-crumbs-keep-the-current-title.zh.md)

## Problem

The conversation header's breadcrumb chain (`packages/client/ui-conversation`, `ConversationSession` header chrome) capped EVERY crumb at 220px with a single-line ellipsis — including the current session's title, which is the crumb that identifies the conversation. A long session title ellipsized at 220px even when the column had hundreds of free pixels beside it, and on phone-width columns the mobile cap of 140px clamped it further. The ancestor crumbs (subagent parent navigation) are legitimately secondary, but the row's `overflow: hidden` plus fixed caps meant the tail — the current title — was the text that got cut. No crumb carried a `title`, so the truncated text was unreachable.

## Decision

The crumb row now guarantees the current title the room, in this order:

- The width cap moved from the button to its seg (`.crumbSeg`, which also holds the `/` separator), and only ANCESTOR segs carry it: 220px, 140px at 720px and below. `.crumbSeg:last-child` has no cap, so the current title uses the remaining row instead of a fixed width.
- The button fills its seg (`width: 100%`, `min-width: 0`), so the ellipsis tracks the seg's actual width; ancestors yield three times faster than the current crumb (`flex-shrink: 3` on `:not(:last-child)`), so the title keeps its text until the chain is squeezed to nothing.
- Every crumb button now carries its full text in `title` (a plain tooltip), so an ancestor that does truncate stays fully readable; the bare sessionId fallback span got the same shrink/ellipsis treatment as the button it stands in for.

The ancestor ellipsis remains deliberate: they are navigation affordances for subagent parent chains, and their full text is now reachable through the tooltip. The current title only ellipsizes as the row's last resort, when the header genuinely has no more room.

## Alternatives considered

**Truncate the head and keep the tail via `direction: rtl`.** Rejected: it flips the visual reading order of the chain, so the `/` separators would read backward (current / parent instead of parent / current) and the ancestry order is the navigation's meaning.

**Horizontal scrolling for the crumb row.** Rejected: a scrollable breadcrumb hides the parents behind a gesture and fights the header's fixed two-row geometry; shrinking ancestors plus tooltips keeps the whole chain visible and reachable.

**Wrap the chain onto a second header row.** Rejected: the header's second row is the view tabs' seat; letting the title steal it reflows the whole column for long names, while the fix above keeps the geometry stable.

**Uncap all crumbs uniformly.** Rejected: ancestor crumbs would then crowd out the current title on phone columns; the shrink weights express the priority the design actually has.

## Consequences

Header geometry is unchanged: the row still never wraps or scrolls, the tab row keeps its seat, and the mobile header padding from the [mobile overlay layout note](2026-08-20-mobile-overlay-layout-mode.md) is untouched. The only DOM addition is the crumb `title`. This completes the clamp-removal pattern the [model menu note](2026-08-20-model-menu-wrap-instead-of-clamp.md) started: surfaces that identify (current title, model name) get the width first, and secondary chrome yields before the identity text does.

## Testing

`packages/client/ui-conversation/tests/skeleton.client.spec.tsx` already pins crumb content (the current-session re-label case) and passes unchanged — the change is presentation-only. The assembled-browser check for visible UI changes remains `DSH_SNAPSHOT=replay pnpm run test:web` in CI; it cannot run on the Android/Termux development host because Playwright ships no browser build for that platform.
