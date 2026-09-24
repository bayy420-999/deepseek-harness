# 2026-09-08 — Slash menu skill categories

## Summary

The composer's `/` skill menu listed every user-invocable skill in one flat run
under the single "Skills" group title. With dozens of installed skills the
relationship between entries (the gmgn-* family, the web reverse-engineering
family, standalone tools) was invisible. Skills now subdivide into labeled
category runs inside the Skills group, grouped byInstall origin: each skill
lives in a `<group>/<name>/` folder or carries an authored `category`
frontmatter override.

## Decision

- **Folder is the group; frontmatter overrides.** Discovery reads one grouping
  level below each skill root (`<root>/<group>/<name>/SKILL.md`); the group
  folder name becomes the category unless the skill authors its own. Deeper
  nesting stays excluded. An authored `category` string wins verbatim
  (trimmed). Names with no category fall into the localized catch-all
  (`menu.other` / 其他). Resolution display-side in `ui-skill`'s
  `candidates` — the grouping is presentation, not invocation semantics.
- **Ordering makes runs.** Candidates sort into category runs: first-appearance
  order of labels (so the catalog's own order decides group order), catch-all
  last, catalog order preserved within a run. The menu then renders a
  sub-heading row wherever the label changes between adjacent items. No menu
  state changes: runs are derived purely from item order, so keyboard
  navigation, `exactMatch`, and picks stay item-indexed.
- **Wire and registry carry the label, nothing else.** `category` flows
  SKILL.md frontmatter (or group folder) → `ParsedSkill` → `SkillCandidate`/
  `SkillDefinition` → `SkillSummary` → `SkillEntry` (skill.list) →
  `InputTriggerCandidate`. `get()` replays the same fallback from the locator's
  recorded group, so loads stay consistent with listings. The registry validates
  it as an optional string (wrong-typed optional values are omitted, same stance
  as `whenToUse`); the zod entry schema rejects empty strings. It never reaches
  the model catalog or the loader wrapper — the catalog omits it alongside
  `whenToUse`/metadata.

## Alternatives considered

- **Group-per-category as separate menu groups** (replacing the single Skills
  group) would have required the reducer's roster to know categories — a
  source contract change and a per-source title-row model — for a purely
  visual split. Rejected; nested runs inside the existing group keep the
  source contract intact.
- **Name-prefix inference** (`gmgn-token` → `gmgn`) was built first, then
  dropped: prefixes are a naming accident, not provenance — they group the
  Emil Kowalski family wrongly and split unrelated same-author skills. The
  folder level records provenance directly.
- **A repos manifest file** (name → repo label merged at discovery) would add a
  second source of truth that drifts from the filesystem. The folders are the
  manifest.

## Enforcement

- MenuView renders category runs from adjacent-item comparison only; picks and
  the highlight never read the heading rows (menu-view spec covers the runs
  and an index-stable pick across a run boundary).
- ui-skill spec covers group labels verbatim, catch-all placement, run
  stability within a label, and whitespace trimming.
- skill-filesystem spec covers folder inheritance, the authored override, the
  single-letter folder floor, and the one-level depth cap; registry validation
  and the skill.list wire schema tests cover the wrong-typed omission and
  empty-string rejection.

## Scope

`packages/skill/skill`, `packages/skill/skill-filesystem`,
`packages/host/apiproxy` (api + schema + projection),
`packages/client/ui-input-trigger` (frozen candidate contract — presentation
addition only), `packages/client/ui-skill`, tests, and the bilingual READMEs.
No session event: the menu is browser presentation; nothing model-visible
changed (the pre-step invocation path is untouched).
