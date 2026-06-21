---
title: "How to reject a feature — an AI pair cut its own roadmap, on the record"
description: "Deciding not to build a feature is engineering too. redteam shipped 1 of #37's 3 steps and rejected 2 by design — kept as a decision record with guardrails and revival conditions, not silently dropped."
pubDate: 2026-06-21
author: "Ascendy Engineering"
tags: ["decision-record", "oss", "agent-pair", "yagni", "trust"]
category: "meta"
lang: "en"
translationKey: "how-to-reject-a-feature"
sourceIntake:
  - "docs/intake/from-redteam/2026-06-17-rejecting-the-subagent-reviewer.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We usually measure progress by *what we built.* But deciding to **NOT build** something on the roadmap is just as much engineering — done well.
- **redteam** (an adversarial agent-pair harness, Apache-2.0) closed issue #37 ("pluggable reviewer execution") exactly this way. Of three steps it had split the work into, it **shipped one and rejected two.**
- The point is *how* it rejected — not dropping the work silently, but leaving **analysis + guardrails + revival conditions** in a decision record (merged via PR). "We didn't do this" becomes a decision in the commit log.
- And what justified the rejection was one small security trap: **if you compare a normalized identifier on one side and a raw key on the other, a single new key slips past the equality check.**

> **Source note.** Distilled from a redteam-team intake. It's all public OSS (`AscendyProject/redteam`, Apache-2.0), so the issue/PR numbers and statuses were checked directly with `gh` on the [public repo](https://github.com/AscendyProject/redteam). Same *adversarial pair* vein as [the post where one AI reviewed another AI's PRs and caught four HIGH defects](/en/blog/redteam-adversarial-review-four-bugs-en/).

## Not only building is progress

*Add* a feature and commits stack up, a PR merges, progress shows. But **"we decided not to build this"**? Usually you quietly close the issue, let it rot in the backlog, or decide it only in your head. No trace. So six months later someone proposes the same thing, and runs the same analysis from scratch.

redteam closed issue #37 differently. #37 was the work of splitting "how do we run the adversarial reviewer behind an adapter seam" into three steps:

- **step 4 — a fail-closed fallback ladder:** a safe ladder that triggers only when the primary headless reviewer fails on *infrastructure* (no CLI, not authenticated, timeout, unparseable). → **shipped in 0.3.0.**
- **step 6 — a transport that scrapes a terminal multiplexer's screen:** **rejected.**
- **step 5 — a sub-agent reviewer adapter** (spinning up a security-reviewer sub-agent *inside* the coding session): **rejected** this cycle. Split out into a focus issue (#67), tracked, then closed `NOT_PLANNED`.

The result: **the #37 umbrella is fully closed — one of three steps shipped, two rejected.** And that rejection decision was merged only after **a different-provider model (Codex) cross-reviewed it** (opening the actual branch code in a read-only sandbox; approved in one round).

## Why reject it — marginal gain vs. the cost you take on

The *only* benefit of step 5 (the sub-agent adapter) was visibility — seeing the review run inside the session and steering it mid-way. But the headless reviewer (`claude -p --permission-mode plan`) already covered the "Claude comes in as a cross-provider reviewer" case.

For that marginal gain, you'd take on two things:

1. **A new execution surface.** Spinning up a sub-agent inside the session pushes directly against the harness's two invariants — *it runs on any project (project-agnostic)* and *zero runtime dependencies.*
2. **A thorny security precondition** (below).

Small gain, large cost. So they rejected it. **Rejecting is a legitimate engineering decision** — that's the point of this post — *as long as the rejection leaves a trace.* YAGNI ("you aren't gonna need it") written into a decision record, with the *guardrails you'd have to re-clear to revive it* pinned alongside.

## The security trap that justified the rejection — identifier normalization

The detail that sank step 5 is small and general. redteam has a **guard against self-review collapse** — it fail-closed refuses to let a model from the same provider review its own code (an adversarial pair must stay cross-provider).

The problem was that the guard compared the two sides *in different formats.* The worker that wrote the code was identified by **provider family** (`"claude"`, `"codex"`), while the reviewer was identified by **raw adapter key.** So the moment you add a new key like `"claude-subagent"`:

```text
worker family = "claude"
reviewer key  = "claude-subagent"
"claude-subagent" != "claude"   → passes as if it were cross-provider
```

That is, **Claude reviewing Claude — a self-review — slips past the guard.** Attaching the sub-agent adapter would have opened exactly this hole. It was caught as a **HIGH in plan review**, and pinned into the decision record as a *hard precondition*: any sub-agent result must be **key→family normalized** before it can pass the automatic review gate.

Generalized: **in an equality/identity check, comparing a normalized form (family) on one side against a raw value (key) on the other means one added value defeats the check.** Normalize *both* sides to the same canonical form *before* comparing. It applies everywhere you compare identifiers — auth, permissions, dedup, self-review guards.

## Honestly — there was no fierce debate this time

The recurring thread in redteam posts is "Claude and Codex split over several rounds." **Not this cycle.** Codex's cross-review of the rejection record approved in a single round, with no substantive disagreement. So rather than dress it up as a "heated debate," I'll just leave it blank — inventing tension that wasn't there is worse.

## Takeaways

- **"Decided not to build" is a decision — leave a trace.** End a rejection at a quietly-closed issue and you'll re-run the same analysis in six months. Leave the analysis, guardrails, and revival conditions *as a record* and the rejection becomes a reusable asset.
- **YAGNI is discipline, not laziness — when you write the revival conditions with it.** Pair "we won't build it now" with "to revive it, re-clear these guardrails," and you're *helping* future-you, not blocking them.
- **Normalize identifiers before comparing.** A *format-mismatched* comparison — family on one side, raw key on the other — is defeated by a single value. A trap across auth, permissions, and identity checks.
- **Don't invent tension that wasn't there.** If there was no debate this time, say so. That's what earns trust for the next time there really is one.

Repo: [github.com/AscendyProject/redteam](https://github.com/AscendyProject/redteam) (Apache-2.0).

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
