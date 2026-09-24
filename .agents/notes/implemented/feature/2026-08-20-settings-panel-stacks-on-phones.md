# Agent Note: Settings panel stacks nav and content on phone widths

Status: implemented

English | [中文](2026-08-20-settings-panel-stacks-on-phones.zh.md)

## Problem

The settings shell (`packages/client/ui-settings-general`, `SettingsRoot`) renders its panel as a fixed two-column modal: a 188px nav rail plus the content column, in an 800px-wide panel capped at `calc(100vw - 48px)`. On a phone the cap leaves ~342px, and the fixed rail consumes 188 of them — the content column, which holds the actual settings pages (general, models, plugins), renders at ~150px. Every page inside it is unreadable at that width, and the panel height (`100vh`) also ignores the mobile browser chrome that hides the bottom edge.

## Decision

Below 720px (ui-layout's `MOBILE_OVERLAY_MAX`, the same breakpoint the frame and conversation header use) the panel stacks:

- `.panel` becomes a column: the nav renders above the content, full width. Tighter gutters (`calc(100vw - 32px)`) and `calc(100dvh - 32px)` under `@supports` keep the panel on-screen under mobile browser chrome.
- The nav becomes a horizontal tab strip: `.navList` flows in a row, cells shrink to 36px-high tabs (`flex: none`, no label ellipsis growth), and the strip scrolls horizontally when the tabs exceed the width. The shared scrollbar rebinding (`--dsh-scrollbar-thumb: transparent`) keeps the strip's bar invisible without changing tab layout.
- `.navTitle` hides on phones — the panel header and the active tab already carry the context, and the title row would cost vertical space the pages need.
- The content header tightens to 46px and `.options` side padding drops to 16px, so the pages get the whole remaining width.

Desktop geometry is untouched; the section pages needed no changes (the models page's add-actions already wrap, and the plugin inventory already stacks its cards below 680px).

## Alternatives considered

**Collapse the nav into a hamburger/dropdown on phones.** Rejected: four sections fit a horizontally scrolling strip, so a drill-in menu would add a tap for no width gain; the strip keeps every section one tap away exactly like the rail.

**Shrink the rail instead of stacking.** Rejected: icon-only tabs would still cost ~48px and the labels (the sections' names) are the navigation; stacking gives the content the full width, which is the actual deficit.

**Let the panel go full-bleed edge to edge.** Rejected: the 16px gutters keep the modal's elevation readable against the conversation behind it and match the app's other phone-width clearances.

## Consequences

The panel's stacking order changes only below 720px; the nav rows, slot seats, close paths (header button, mask click, Escape), and section render contracts are untouched. The strip's horizontal scroll is the only new gesture, and it only appears when the tabs genuinely exceed the width. This continues the mobile-readability family (frame overlay mode, [header crumbs](2026-08-20-header-crumbs-keep-the-current-title.md), [clamp removals](2026-08-20-model-menu-wrap-instead-of-clamp.md)) on the settings surface.

## Testing

`packages/client/ui-settings-general` suite (44 tests) passes unchanged: the change is CSS-only and the specs assert section content, slot seats, and close behavior rather than panel geometry. The assembled-browser check for visible UI changes remains `DSH_SNAPSHOT=replay pnpm run test:web` in CI; it cannot run on the Android/Termux development host because Playwright ships no browser build for that platform.
