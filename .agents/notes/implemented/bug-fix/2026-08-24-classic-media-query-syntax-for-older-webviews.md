# Agent Note: Classic media-query syntax for older WebViews

Status: implemented

## Problem

Client-bundle CSS Modules are compiled by lightningcss, which by default emits
modern range syntax for media queries (`@media (width<=720px)`). WebViews
older than Chromium 104 do not parse the range form and drop the rule
verbatim, silently disabling the 720px phone breakpoint on those shells.

## Decision

Compile every client-bundle CSS Module against a conservative Chrome 90 target,
so lightningcss emits classic syntax (`@media (max-width:720px)`) that every
supported WebView parses.

## Implementation

- `packages/client/tsdown.client.ts`: `CSS_TARGETS = { chrome: 90 }` passed as
  `targets` to the CSS Modules `transform` call in the `dsh-css-modules-inline`
  plugin.
- `scripts/client-bundle-css.spec.ts`: a case that runs a fixture stylesheet
  with a 720px media query through the plugin and asserts the output uses
  `@media (max-width:720px)` and never `width<=`.
