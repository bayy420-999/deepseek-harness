# Agent Note: Sidebar time cell and goal-bar label yield to identity text

Status: implemented

English | [中文](2026-08-20-secondary-chrome-yields-to-identity-text.zh.md)

## Problem

Two more surfaces let secondary chrome starve the identity text. The sidebar session row (`packages/client/ui-workspace`) pinned its relative-time cell with `flex: none`, so on a tight column the session title — the row's identity — truncated while the timestamp kept its full width. The goal bar (`packages/client/ui-goal`) pinned its phase label the same way: on a phone-width composer card the fixed 「进行中/已暂停」 label plus the action buttons left the objective — the bar's identity text — a two-character ellipsis. The pattern the [header crumb note](2026-08-20-header-crumbs-keep-the-current-title.md) established — identity text gets the width first, secondary chrome yields — applied to both.

## Decision

- **Sidebar session rows** (`Rows.module.css`): `.sessionRow .title` switches from `flex: 1` (zero basis) to `flex: 1 1 auto`, so the title's natural content width is its flex base. The `.time` cell switches from `flex: none` to `flex: 0 6 auto` with `min-width: 0` and its own ellipsis: it shrinks six times faster than the title and truncates itself first, vanishing entirely only in an extreme squeeze. The hover swap (time cell → action buttons) is unchanged, and the row's hover card remains the full-text surface for the title and path.
- **Goal bar** (`GoalBar.module.css`): `.dock` becomes an anonymous `inline-size` container, and below 420px card width `@container` hides the phase label. The glyph and the pause/resume action still communicate the phase, and the whole objective remains reachable through the bar's existing `title`. The objective keeps its single-line ellipsis — the bar is a fixed-height member of the Todo/Queue composer-card family — but it now receives the label's width before it truncates.

No markup, locales, or store data changed; both fixes are CSS-only.

## Alternatives considered

**Wrap the objective to two lines instead of hiding the label.** Rejected: the goal bar's 36px height is the shared geometry of the Todo/Queue composer-stack family; a taller bar breaks the family's single-line scan, and the label-hide frees ~80px on the cards that actually lack room while wide cards keep the label.

**Ellipsize the sidebar time cell only (no shrink priority).** Rejected without the `flex-shrink: 6` weight the proportional shrink hits the title harder than the timestamp, because the title's content basis dwarfs the time cell's.

**Keep `flex: 1` (zero basis) on the sidebar title.** Rejected: a zero-basis item has no shrink contribution, so the time cell would collapse to nothing before the title moved — the shrink weights need the title's real content basis to express "time yields first, title second".

**A viewport media query for the sidebar.** Rejected: the sidebar renders at the same 280px on desktop and in the mobile drawer, so viewport width cannot distinguish the tight case; the flex weights work at every column width without one.

## Consequences

Row heights and the hover-card contract are untouched; the time cell only ever truncates when the column genuinely lacks room, and the title now holds its text longer at every sidebar width. The goal bar's dock is now a layout containment context (inline-size), which is safe for its static, non-portalled children. This completes the clamp-removal family started by the [model menu note](2026-08-20-model-menu-wrap-instead-of-clamp.md) and the [header crumb note](2026-08-20-header-crumbs-keep-the-current-title.md).

## Testing

`packages/client/ui-workspace`, `packages/client/ui-goal`, and `packages/client/ui-sidebar` suites pass unchanged (the two slow-device timeouts in the first run pass at a 30s timeout): the changes are presentation-only, and the goal-bar spec asserts content presence, which the CSS-only label hide keeps. The assembled-browser check for visible UI changes remains `DSH_SNAPSHOT=replay pnpm run test:web` in CI; it cannot run on the Android/Termux development host because Playwright ships no browser build for that platform.
