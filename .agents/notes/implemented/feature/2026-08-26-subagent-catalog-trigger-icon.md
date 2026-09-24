# Agent Note: Subagent catalog trigger uses a branch icon in the header

Status: implemented

## Problem

The subagent catalog trigger in the conversation header rendered the descendant
count as visible text ("N 子代理" / "N subagents"), competing with the mode
pill and session-log button for the header's limited horizontal space. On a
phone the count text was the largest element in the row and it was not
touch-actionable help: the count is still available in the accessible name and
the catalog rows.

## Decision

Replace the visible count `<span>` with `IconBranchOutline16`. The icon
communicates "subagents" without text, mirroring the `IconQueueOutline14`
pattern used by the job-list action. The trigger keeps the StateDot for
running activity and the chevron for the dropdown affordance; the aria-label
retains the running / total count for screen readers and native tooltips.

## Implementation

- `packages/client/ui-subagent/src/client/SubagentCatalogAction.tsx`:
  added `IconBranchOutline16` to the ui-primitives import; replaced the
  `<span className={css.count}>` with the icon.
- `packages/client/ui-subagent/src/client/SubagentCatalogAction.module.css`:
  replaced `.count` with `.triggerIcon` (flex-none, inline-flex).
- `packages/client/ui-subagent/tests/conversation-ui.client.spec.tsx`:
  split the singular-key test into a running case (only `count.running.one`
  is called) and an idle case (only `count.total.one` is called), since the
  visible count is no longer rendered.
