# Agent Note: Appearance row collapses to a dropdown on mobile

Status: implemented

## Problem

The Appearance row in the General settings section rendered as a column with a title
("外观"/"Appearance") and three large selector cubes (Light, Dark, System), each a
276x82 box with an icon stacked above a label. On a desktop 800px panel the three
cubes fit in one row (180px each, flex-basis wrapping). On a mobile viewport
(~360–390px effective content width) the cubes wrapped to two rows, producing a
3-row block (title + two cube rows) that was significantly taller than every other
settings row — all of which are single-line title + control layouts. The user
reported it "feels out of place for mobile design because for that specific setting
the menu is too big compared to the rest."

## Decision

Replace the entire cube selector with a single compact row matching the other
General section items (Language, Enter behavior, Agent preset, Permission): a
title on the left and a dropdown selector pill on the right. The pill opens a
Menu with the three options (Light / Dark / System), each with a checkmark when
active. This is the same component pattern used by the Language row, so the
appearance row is no longer a special case in the settings layout.

### Implementation

- `packages/client/ui-theme/src/client/AppearanceRow.tsx`: rewrote the component
  from a title + `.cubeRow` of three buttons to a `.row` + `.rowText` + `.title`
  + `<Menu>` with a button anchor using `IconChevronDownOutline14`. Removed the
  `clsx` dependency and the three icon imports (`IconLightOutline16`,
  `IconDarkOutline16`, `IconFollowsystemOutline16`); added `useState` for the
  menu open state and `Menu`/`IconChevronDownOutline14` from ui-primitives.
  `selectedId` on the Menu marks the active preference with a checkmark icon.
- `packages/client/ui-theme/src/client/AppearanceRow.module.css`: replaced the
  cube styles (`.group`, `.cubeRow`, `.themeCube`, `.selected`) with the
  single-row `.row` / `.rowText` / `.title` / `.selector` / `.chevron` pattern
  that mirrors the Language row CSS exactly. Removed the mobile media query
  block (no longer needed — the single row works at all widths).
- `packages/client/ui-theme/tests/appearance-row.client.spec.tsx`: rewrote the
  test suite from cube-button assertions (`aria-pressed`, three `<button>` roles)
  to dropdown-pill assertions (`aria-expanded`, `role="menuitem"`). The new
  suite covers the same behaviors: renders title + shows current preference,
  opens menu with three options, selects and closes, closes on outside click,
  and follows store updates.

## Alternatives considered

**Keep the cubes but collapse them to one row on mobile.** The user initially
asked for "1 row" and then "2 rows so the title isn't cropped". After seeing
both proposals they chose "just make it 1 row with dropdown like the rest"
— the compact dropdown is the same pattern every other row uses, so the
appearance row no longer stands out as oversized.

**Icon-only cubes on mobile.** Dropping the labels would save space but lose
the discoverability of the three options; the settings menu already has no
icon-only controls. The dropdown with text labels is consistent with the
Language row's pattern.

## Consequences

- The Appearance row is now 54–69px tall (matching the Language row) on every
  viewport width, eliminating the mobile sizing issue entirely.
- The three theme options are now behind a dropdown click rather than always
  visible, which is a one-step trade-off for consistency. The selected option
  is still visible on the pill at all times, and the Menu shows both the
  label and a checkmark for the active item.
- The icon decorations (sun, moon, system-arrows) are gone — the dropdown
  uses only text labels. The user explicitly chose "dont care with the icon."
- No new mobile CSS is needed — the single-row layout works at all widths
  through the same CSS the Language row uses.

## Testing

- All 4 tests in `appearance-row.client.spec.tsx` rewritten to assert the
  dropdown behavior: title, selector pill label, menu open/close/select,
  outside-click dismissal, and store-driven pill updates.
- All 64 ui-theme tests pass (including the 8 integration tests in
  `apply.client.spec.ts` that verify the component registration and locale
  binding).
- Client typecheck (`pnpm exec tsc -b tsconfig.client.json`) passes clean.
- Manual browser verification at 390px and 780px viewports: the row renders
  as a single compact line with the selector pill on the right; the pill
  opens a menu listing all three options with a checkmark on the active one;
  selection updates the pill label and closes the menu.
