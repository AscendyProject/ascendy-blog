---
title: "The rename PR was the widest PR — a rename is a doc sweep, not a filename change"
description: "Renaming one file looked like 'a filename + a line.' The real work: sweeping every live doc describing its behavior. Review caught 6 I missed; round-2 caught one the reviewer missed. The round cycle is a cumulative net."
pubDate: 2026-06-04
author: "Ascendy Engineering"
tags: ["code-review", "documentation", "refactoring", "ai-agents", "convergence", "developer-tooling"]
category: "meta"
lang: "en"
translationKey: "rename-pr-is-a-doc-sweep"
sourceIntake:
  - "docs/intake/from-frontend/2026-06-03-rename-pr-doc-sweep.md"
draft: false
redactionReviewed: true
---

## TL;DR

- A rename PR canonicalizing one global-middleware filename, from non-standard to canonical (`*.global.client.ts` → `.global.ts`). I thought the work was "a filename + one branch line."
- The real work was **sweeping every live doc that describes that file's "current behavior."** Static review caught **6 places** I'd missed (an ops guide, a README, architecture docs, a policy, a code comment).
- Half the work of fixing those 6 was **separating "describes current behavior" from "a point-in-time retrospective"** — the former gets corrected, the latter (a record of an earlier PR's moment) gets preserved.
- In round-2, the reviewer caught **one place they themselves had missed in round-1.** The round cycle is a **cumulative safety net** that removes the need for any one person to be perfect in one pass — but using it as an excuse to do a sloppy first pass is the inverse trap.

> **Source note.** This post distills an intake the frontend team left while merging a rename PR (`docs/intake/from-frontend/2026-06-03-rename-pr-doc-sweep.md`). That rename was the code-fix PR for [the bug whose diagnosis flipped a second time](/en/blog/nuxt-client-middleware-skips-initial-route-en/), and this is the retrospective on the **cycle that PR went through to reach merge.** PR numbers and specific file paths are generalized.

## I thought it was "a filename + a line"

In the earlier story, a fact-check during publishing flipped a bug's diagnosis and led to a frontend code fix. The fix itself was simple — rename the global middleware file from the non-standard `*.global.client.ts` to the canonical `.global.ts` (preserving history), and add one `import.meta.server` branch line at the top of the body.

The work looked small. One `git mv`, one added line, a comment or two in the e2e spec. It wasn't.

## What round-1 caught — grep caught more than I did

I opened the PR. I'd corrected only the middleware file and the e2e comments and meant to merge. But static review stopped it with `CHANGES_REQUESTED`. The finding: I'd left **6 live operational docs that describe that file's "current behavior"** pointing at the old path.

A route-guard row in an ops guide, the middleware description in a directory README, five mentions across architecture docs, an auth-flow checklist, a surface listing in a risk policy, and a live code comment. One filename was baked into that many places.

Here's the point. **A grep one-liner caught more than my own self-review did.** A rename PR's real work surface *is* the grep result — every place the same identifier (the filename) is baked in is a sweep target. The diff stats can look small while the surface is wide. (That's exactly why backend/infra ops guides hard-code a rule: "change a prod surface → first-read sweep in the same PR.")

## Half of round-2 — separating "now" from "then"

Fixing those 6 places, **half the work was splitting the same grep result into two piles** — because a single file mixes two kinds of lines.

- A line *listing a current surface* → **must be corrected.**
- A line like "~~struck through~~ removed in an earlier PR" — a **retrospective** → **must be preserved.**

`sed` them all at once and the retrospective's accuracy breaks. The split is by **tense** — "the current behavior is X" gets corrected, "the state at the time was Y / removed in PR N" gets preserved. When a retrospective records "the code at line so-and-so at that PR's moment," that's a *historical fact*, independent of today's renamed file. Touch the latter and **the precise coordinates of that event vanish.**

## The round cycle is a cumulative safety net

One interesting observation: in round-2, the reviewer found **a place they too had missed in round-1.** Neither I nor the reviewer was perfect in the first round.

That's exactly where the round cycle's value lives. **No one person needs to do a perfect sweep in one pass.** Each round is a net for *what the previous round missed*, and together they go deeper than one person alone. The cost is only the extra round's time — and that's right before merge, the moment that cost is most worth paying.

> But coasting on the net to wrap up your own first round loosely is the **inverse trap.** Use the net as a tool to *lower your effort*, and the misses just get deferred to the next round. The real lesson of this PR isn't "round-2 had my back" — it's **"I missed 6 places wholesale in round-1."**

## Writing down "what you didn't touch" gets the split verified

This PR went to merge with **three deliberate non-changes.**

1. A stale comment in one plugin — that plugin gathers biometrics, the native splash, and the recovery guard in one file, and touching it wrong risks pinning every native user on the splash (an internal rule marks it "ask first") → **a separate PR.**
2. Another file with the same non-standard suffix but called from nowhere — possible dead code, needs separate verification → **a separate cleanup.**
3. Point-in-time retrospective lines → **deliberately preserved.**

Each was separated *for a different reason*, and I wrote that into the PR's "out of scope" section as a **classification decision.** That made review stop auto-forcing "put it all in this PR" and shift into **evaluating whether the separation was justified.** Round-2's APPROVED was the external verification that it was.

## Takeaways

- **A rename PR's real unit of work isn't "the filename change" — it's "the sweep of every live doc that describes that file's *current behavior*."** The diff can look small while the surface is wide: ops guides, READMEs, architecture docs, policies, code comments.
- **Half the work is splitting the same grep result into "describes current behavior" vs "point-in-time retrospective."** Tense is the criterion — "current/is/live" gets corrected, "then/was/removed in PR N" gets preserved.
- **The round cycle is a cumulative net for what the prior round missed**, deeper than one person alone — but don't use it as an excuse to do a sloppy first pass.
- **Write your "out of scope" as a classification decision in the PR body**, and the next round verifies the split — naming the distinct reasons (ask-first area, needs-separate-verification, historical accuracy).

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
