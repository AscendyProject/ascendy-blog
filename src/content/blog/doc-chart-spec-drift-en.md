---
title: "Following the spec produced a false negative — when docs and code drift apart"
description: "A governance doc's commands drifted from a Helm chart's runtime needs, so a verify following the doc exactly produced a false negative — misread as an environment problem. The structural weakness of doc-as-spec."
pubDate: 2026-05-28
author: "Ascendy Engineering"
tags: ["helm", "documentation", "agent-workflow", "root-cause-analysis"]
category: "infra"
lang: "en"
translationKey: "doc-chart-spec-drift"
sourceIntake:
  - "docs/intake/from-infra/2026-05-28-doc-chart-sync-path-drift.md"
draft: true
redactionReviewed: false
---

## TL;DR

- We ran a command from a governance doc **verbatim** and it failed. The first diagnosis was "did the environment break?" — but the real cause was that **the doc's command form had drifted from the chart's actual requirement**.
- A verify that followed the doc exactly produced a **false negative**, and it was misclassified as "an external environment problem," dragging out one extra cycle.
- Small conclusion: sync the doc and you're done. **Big conclusion: without a *mechanism* that keeps the sync, the same pattern recurs every time the chart's runtime contract changes.**

## What happened

During a PR's verify step, we ran a command from the governance doc. It failed, and the first analysis was "pre-existing breakage on main." We split it off and didn't block that PR's merge.

Just before opening the next cycle, we re-investigated and found main wasn't broken. The chart itself was sound; the **command form written in the governance doc had drifted from the chart's runtime requirement**. The side following the doc-as-spec produced a false negative, and that false negative was misclassified as "environment breakage." A follow-up PR fixed it by aligning the doc's command blocks with the chart's actual invocation form.

## The direct cause is trivial

At some point the chart's helpers file gained a `required` guard — a Helm function that fails rendering if a value is missing. The PR that introduced it was an incident response (blocking a regression where a release went out with an empty image tag). After the guard, `helm template` / `helm lint` only pass if the image tag is supplied explicitly.

CI's lint job knew this — right after the guard, it was updated to pass placeholder tags for each component. **CI was green.** But the governance doc's command block wasn't updated. It still listed the pre-guard command form (`helm lint <chart>`). Same chart, two results — CI passes, the doc-follower fails.

## The problem is the decision structure

This isn't a simple omission; it's a **structural weakness of the doc-as-spec workflow**.

The governance doc is the single entry point you read when verifying — a promise that "running this command finishes the verify." CI is the *execution* of that promise, not its *definition*.

That assumption breaks the moment the chart's runtime contract changes. When a guard is introduced, a helper gains a new required field, or the image repository changes, the doc's command no longer reflects the chart's real requirement. And CI doesn't catch that gap — CI passes with *its own* invocation form; it doesn't verify that the doc's invocation form is in sync.

The result: two sources of truth start saying different commands for the same chart. The next person to verify by following the doc gets a false negative even though they ran the spec exactly. And the first instinct on a false negative is **"is something broken in the environment?"** — because the doc says "this command must pass," so if it doesn't, it gets blamed on the environment. That's how the drift carries one more cycle.

## Decision / tradeoffs

The small conclusion is "sync the doc and you're done." The big one is different — **unless you capture *how* the sync stays maintained as a mechanism, this pattern recurs every time the chart's runtime contract changes.** This is a path-drift pattern we've caught repeatedly, and the omission is not a matter of will but of a **missing mechanism**.

Two practical notes:
- If the same command block appears in two places in one file (e.g., an execution block and a verification block), **both** must be synced. Fixing only one reintroduces the drift within the same PR.
- Introducing a chart-level guard like `required` grows the surface to sync from doc-only to "doc + CI + verify script" — three places. The introducing PR should touch all three together.

## What's next

- Consider a mechanism that enforces the sync (e.g., CI runs the doc's command blocks verbatim to verify them).
- See: [Helm `required`](https://helm.sh/docs/chart_template_guide/functions_and_pipelines/#using-the-required-function), [Helm `--set`](https://helm.sh/docs/intro/using_helm/#the-set-flag).

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
