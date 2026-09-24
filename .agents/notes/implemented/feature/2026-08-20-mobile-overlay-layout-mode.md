# Agent Note: Mobile overlay layout mode — drawers instead of squeezed columns below 720px

Status: implemented

English | [中文](2026-08-20-mobile-overlay-layout-mode.zh.md)

## Problem

The AppFrame concession chain (packages/client/ui-layout) is desktop-first: the center column floor is 640px, details never renders below 300px, and the sidebar never concedes below 264px. On a phone-width viewport that chain makes both panels unusable. Opening details below ~940px resolves to zero width (the chain's step-3 auto-close), so the "inspect" actions silently do nothing on a phone. Expanding the auto-collapsed sidebar squeezes the center to ~80px on a 360px screen — the design's own "center absorbs the squeeze" fallback, but unusable in practice. The mount chain also used `height: 100%`, which mobile browsers resolve against the large viewport, so a visible URL bar or toolbar hid the composer below the fold.

## Decision

AppFrame switches to a mobile overlay mode below `MOBILE_OVERLAY_MAX` (720px, columns.ts):

- The grid carries only the collapsed rail track (56px) and the center column. Open panels stop being grid tracks, so the center never concedes width to them.
- The expanded sidebar renders as an overlay drawer: the same `.sidebarCol` container becomes absolute at `SIDEBAR_DRAWER_WIDTH` (320px, clamped to `viewport - 64` so the chat edge stays reachable), above a tap-to-close scrim (`--dsw-alias-bg-mask-1`). Toggling reuses the existing narrow semantics — `toggleSidebar` flips the store's `narrowExpanded` override, so no new store state exists and no preference is rewritten.
- Open details renders as a full-frame overlay panel (the `.detailsCol` container becomes absolute at `inset: 0`) with the panel's existing close button.
- Both containers swap classes, never mount points, so the slot subtrees stay mounted across the posture change; the concession solver still runs on the rail-only grid (its output is unused for the overlay widths).
- Drag handles do not render below 720px; there are no grid-resizable columns there.
- Both overlays sit at z-index 12 (scrim 11), below the shell overlay layer (20) and portalled menus (100+); the details overlay covers the drawer when both are open.
- Crossing the breakpoint in either direction needs no migration: preferences were never touched, so re-widening restores the ordinary columns (a still-open drawer becomes the expanded narrow column, as before).

The same change also switches the shell mount chain (`packages/client/web/src/base.css`) from `height: 100%` to `height: 100dvh` where supported (inert on desktop, where dvh equals the ordinary viewport height), and ui-conversation tightens the header clearance (12/16px side padding) and crumb cap (140px) at 720px and below.

## Alternatives considered

**One overlay breakpoint at `SIDEBAR_AUTO_COLLAPSE` (1024px).** Rejected: tablets in portrait genuinely fit the rail plus a usable center, and the rail keeps the workspace list reachable without a gesture; 720px keeps the desktop behavior intact for everything wider than a phone.

**A full-viewport drawer.** Rejected: it would hide the chat behind the drawer completely; stopping 64px short leaves the conversation edge visible as both a close cue and a tap target, matching the scrim.

**New store flags for the mobile posture.** Rejected: `narrowExpanded` already encodes "the user re-expanded the sidebar while narrow", and the drawer is exactly that posture rendered differently; adding parallel state would create two sources of truth for one toggle.

**A bottom sheet or right-edge sheet for details.** Rejected: the details panel's main payload is terminal output and JSON, which want the full width; `inset: 0` reuses the panel's own close button with no new chrome.

**Keep the squeezed-center behavior.** Rejected: it was the status quo, and the 80px center it produces on phones is the defect this note removes.

## Consequences

The rendered width below 720px is no longer a pure function of the stored preferences (the drawer and overlay widths are derived), but the stored preferences remain pure and untouched, so the concession chain's no-hysteresis contract is intact above the breakpoint. Nothing outside ui-layout reads the overlay containers; the sidebar owner share keeps its `collapsed`/`width` contract, with `width` now the drawer width while open on mobile. The details slot subtree stays mounted at zero width when closed, exactly as before. The ui-layout README pair documents the mode.

## Testing

`packages/client/ui-layout/tests/app-frame.client.spec.tsx` gains an "AppFrame — mobile overlay mode" block (8 cases): the rail-only mount, drawer opening without track changes (owner props at the drawer width), the drawer-width clamp at a 360px viewport, scrim-tap close, details rendering as an overlay with the frame attribute absent, closeDetails dropping the overlay, and both breakpoint exits (drawer open and details open) restoring the column posture with the slot subtrees still mounted. The assembled-browser check for layout-visible changes remains `DSH_SNAPSHOT=replay pnpm run test:web` in CI; it cannot run on the Android/Termux development host because Playwright ships no browser build for that platform.
