# Agent Note: Q&A flow advances through one next action

Status: implemented

## Problem

The Q&A (prompt) composer footer offered an icon pager (`‹ 1 / 3 ›`), a
separate "跳过本题" (skip) outline button, and a primary "下一题"/"提交" button
that stayed disabled until the current question was answered. On the free-form
(optionless) surface a user reported that the only visible action was
"跳过本题": the primary button renders at 40% opacity while the draft is
empty, so on a phone it reads as "no way to go to the next question" and, on
the last question, "no way to submit these answers". The split between skip
and next also made the touch flow (button-only advance, from the Enter-newline
change) two-step.

## Decision

Replace the footer with one two-button row: `<上一题>  1 / 3  <下一题/提交>`.
The next action is never disabled by the unanswered state and always advances:

- **Answered question** (an option selected or the text input filled): fills
  the draft and advances.
- **Unanswered question** (not the last one): skips it — marks the draft
  `skipped` and advances.
- **Last question**: submits the batch; an unanswered last answer is marked
  skipped first so the batch completes. Skipped questions carry
  `selected: []` in the answer envelope.

The previous action goes back one question with the saved draft for that
question: drafts are held per question index, and revisiting a skipped question
to answer it clears its `skipped` flag (draftCustom resets it).

### Implementation

- `packages/client/ui-user-questions/src/client/QuestionComposer.tsx`:
  `skipQuestion` now only marks-and-advances; the new `advance` (the single
  next action) decides fill / skip / submit; the footer renders two `Button`s
  around a `.footerCenter` progress + error column. `continueFromCustom`
  (fine-pointer Enter) calls `advance`, so keyboard and button behave alike.
- `packages/client/ui-user-questions/src/client/QuestionComposer.module.css`:
  removed `.pager`/`.footerActions`, added `.footerCenter`; the error line is
  centered under the progress counter.
- `packages/client/ui-user-questions/src/client/locales.ts`: removed
  `error.incomplete`, `error.unanswered`, and `nav.next` (no longer rendered).

## Alternatives considered

**Keep the last question erroring when unanswered.** With the skip button
gone this is a dead end: there is no way to leave the last question, so "next
on last = submit" must also honor "empty = skip" by marking the last answer
skipped before submitting.

**Keep a separate skip button next to next.** The report was precisely that the
two-button footer reads as "only skip available"; a single always-enabled next
action removes the disabled-primary confusion and gives touch users one obvious
advance path.

**Keep the completeness guard inside submitDrafts.** Completeness is now
enforced where the decision is made — advance() marks the current question
answered-or-skipped before moving on, and the option-button Enter path gates on
`drafts.every(completed)` — so the guard would be unreachable; the keys are
removed from the dictionaries.

## Consequences

- The footer is identical on every surface (options, multi-select, free-form):
  previous, `1 / N`, next. The next label is 下一题 except on the last
  question, where it is 提交 (正在提交… while busy).
- The reported problem is gone: the next/submit button no longer depends on the
  draft state, so touch users always have an enabled advance path.
- Skipping is implicit — next on an unanswered question silently advances; an
  unanswered last question submits as skipped.
- Fine-pointer Enter matches the button exactly (advance, skip, or submit), so
  desktop keyboard flow and the touch button flow stay consistent.

## Testing

- Rewrote "skips individual questions..." as "skips unanswered questions
  without discarding earlier answers": the next action on an empty question
  advances (skip) and last-question submit counts the empty last answer as
  skipped.
- Rewrote "shows the inline custom input, reports missing answers, and
  supports pager navigation" as "keeps Shift+Enter as a textarea newline,
  skips unanswered questions, and preserves drafts on previous": Shift+Enter
  stays a newline, Enter on the empty textarea skips, and the previous button
  returns with the draft preserved.
- Updated "surfaces cancellation failures" and "renders chrome copy through
  the English dictionary" for the new footer buttons.
- The rest of the suite (batch submit, IME composition, transport failures,
  collapse, coarse-pointer Enter) passes unchanged.
