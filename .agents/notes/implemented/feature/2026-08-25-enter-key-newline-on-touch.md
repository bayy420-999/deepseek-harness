# Agent Note: Plain Enter is a newline on coarse-pointer devices

Status: implemented

## Problem

On Android (and other touch devices) there is no hardware Shift key, so the
main conversation composer's Enter-to-send (Shift+Enter newline) leaves no way
to insert a newline. The Q&A (prompt) composer has the same issue: its
free-form textarea advances on Enter, so a multi-line answer is impossible on
touch.

## Decision

The main composer (`InputBar`) and the Q&A composer (`QuestionComposer`) detect
a coarse primary pointer via `window.matchMedia('(pointer: coarse)')`. On
coarse-pointer devices (phones, tablets, iPads):

- **Main composer**: plain Enter inserts a newline (native, unclaimed). Sending
  is button-only. Ctrl/Meta+Enter (accelerated send/steer) still works for
  attached hardware keyboards. The textarea omits `enterKeyHint` on touch so
  soft keyboards keep their default newline-arrow key (the standard behavior
  for textareas).
- **Q&A composer, single-line `<input>`**: Enter is inert (no-op). The flow
  advances only through the "next"/"submit" buttons. The `enterKeyHint` is
  omitted so the soft keyboard keeps its default return key.
- **Q&A composer, free-form `<textarea>`**: Enter is a newline (native,
  unclaimed). The flow advances through the buttons. The `enterKeyHint` is
  omitted (default newline-arrow key for textareas).

On fine-pointer (desktop) devices the behavior is unchanged: Enter sends in
both composers, Shift+Enter inserts a newline, and the `enterKeyHint` is
`'send'` (ignored by physical keyboards, correct for the rare virtual keyboard
on desktop).

### Implementation

- `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`:
  `touchEnter` useMemo from matchMedia; accelerated chord gate; enterKeyHint
  on the textarea.
- `packages/client/ui-user-questions/src/client/QuestionComposer.tsx`:
  `touchEnter` useMemo in `QuestionFlow`; `continueFromCustom` early-return on
  touch; enterKeyHint on the input and textarea.

## Alternatives considered

**Make Enter=newline unconditional on all devices.** Regresses desktop UX where
Enter-to-send is the expected behavior and Shift+Enter newline has been the
standard since the original chat app. The device detection preserves the
desktop muscle memory.

**Add a user-facing "Enter sends" toggle in settings.** More flexible but (a)
the composer doesn't currently read any settings, (b) threading a new
projection through the slot system is a larger change than the problem
warrants, and (c) the device-based heuristic is correct for the vast majority
of usage — a desktop user who wants Enter=newline already has Shift+Enter.
Adding a toggle can be a later refinement.

**Keep Q&A Enter=send on all devices (exempt Q&A from the touch change).** The
user's original message requested this, but on review they chose consistency
over the Q&A exemption: the Q&A buttons are the send path on touch, matching
the main composer. The trade-off is that a mobile user answering a free-form
question must tap the button to advance instead of pressing Enter.

## Consequences

- Touch users get a working newline in the main composer (the feature that was
  missing). The send button is the only send path, which is natural on mobile.
- Touch users typing a multi-line Q&A answer in the textarea can use Enter to
  newline; they tap the button to advance to the next question or submit.
- Desktop users see no change: Enter sends, Shift+Enter newlines.
- The `enterKeyHint` attribute is omitted on touch (textareas then default to
  their newline-arrow key, single-line inputs to their return key) and set to
  `'send'` on fine-pointer devices (ignored by physical keyboards, correct for
  the rare virtual keyboard on desktop). This is a best-effort hint: some
  keyboards and browsers ignore it.
- The `matchMedia` call is a one-shot check at component mount. It does not
  react to pointer changes (the primary pointer type does not change during a
  page session). The existing ConversationRoot already uses the same check for
  keyboard-avoidance heuristics.
- jsdom has no matchMedia implementation, so the test suite runs the
  fine-pointer path (desktop behavior) — all existing tests pass unchanged.

## Testing

Added `input-bar.client.spec.tsx`:
- "on a coarse-pointer device plain Enter is a native newline, not a send" —
  stubs window.matchMedia to return `{ matches: true }`, asserts Enter not
  prevented, sink not called, no enterKeyHint (default newline key), and
  accelerated send still works.
- "a fine-pointer device keeps Enter-to-send and the send key hint" — no stub,
  asserts Enter submits and enterKeyHint is 'send' (jsdom path).

Added `user-questions-composer.client.spec.tsx`:
- "on a coarse-pointer device Enter stays a newline in the free-form textarea
  and is inert in the single-line input" — stubs matchMedia, asserts Enter is
  inert in the input, unchained in the textarea, no enterKeyHint on either, and
  the button still advances the flow.
