# Agent Note: Explicit attach-image button in the composer (mobile image intake)

Status: implemented

## Problem

The composer admitted images through exactly two gestures: clipboard paste and whole-page drag-and-drop. Touch devices have neither — mobile browsers do not expose clipboard image paste, and drag-and-drop does not exist on coarse-pointer input. On a phone the only way to get an image into a session was to ask the agent to open the file itself (the `read_image` tool), which is not how multimodal chat is supposed to work. Desktop users could also not attach without a file already sitting in the clipboard or being drag-ready.

## Decision

Add an explicit attach button to the composer tool row, immediately before the `+` commands control, matching its 28px circular seat (`css.add`). The button opens a hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>` via a programmatic `.click()` and routes the picked files through the existing `intakeImages` wrapper, so every pre-check (format, count, per-image and aggregate bytes against the `imageLimits` projection) and every rejection toast behaves identically to paste and drop. The input is visually clipped but kept in the DOM (`clip: rect(0 0 0 0)` — not `display: none`, which some mobile engines refuse to open programmatically), never a tab stop, and sits outside the button element (interactive content nested inside a button is invalid and breaks picker clicks). The button renders only when an attachment service is composed (`addImages !== undefined`) and disables while the composer is locked or busy, mirroring the drop overlay's gating. Label: `input.attachImage` (添加图片 / Attach image).

## Alternatives considered

**Reusing the existing paste/drop-only intake.** The root cause of the mobile gap, not a fix — touch has neither gesture.

**Nesting the file input inside the button.** Invalid HTML; browsers may not forward the synthetic click, and the picker opens from the button's own click anyway.

**`display: none` on the input.** Reliable on desktop, historically flaky on mobile engines when opened via `.click()` from a gesture; the clipped-presence pattern avoids the risk at one line of CSS.

## Consequences

Mobile users get the same explicit attach affordance as every other chat client: tap the paperclip, pick from the system image picker, see the rail thumbnails and send. Desktop gains the button too — paste and drag remain, so no existing behavior is removed. The accept list stays aligned with `imageMediaType`'s positive list so the picker only offers what the host will accept. Tests cover the picker wiring (files flow into `addImages`, value resets for re-pick, limit pre-checks surface as toasts) in `input-bar.client.spec.tsx`.
