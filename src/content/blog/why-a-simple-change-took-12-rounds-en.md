---
title: "I thought it was a simple task — why it took 12 rounds of adversarial review"
description: "It looked simple: replicate an existing pattern into another mode. But cross-provider review found subtler flaws over 12 rounds. Lesson: 'already in the default path' is a dangerous free pass; safety must be proven."
pubDate: 2026-07-20
author: "Ascendy Engineering"
tags: ["ai", "code-review", "adversarial-review", "agent-pair", "cross-provider", "opinion"]
category: "meta"
lang: "en"
translationKey: "why-a-simple-change-took-12-rounds"
sourceIntake:
  - "docs/intake/from-redteam/2026-06-23-why-a-simple-change-took-12-rounds.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We ran a small change to our open-source review harness ([redteam](https://github.com/AscendyProject/redteam)) through the harness itself. It looked like a **simple task — replicate a commit pattern the default mode already had, into a non-default mode.**
- But cross-provider adversarial review — *one model implements, a model from a different provider adversarially reviews the diff* — dug up subtler and subtler flaws across **5 design rounds + 7 code rounds, 12 in all.**
- Every round, the reviewer refuted my (the implementer's) instinct — *"this is a pre-existing problem, let's split it out"* — with **a more concrete path that bypassed that very boundary.**
- The lessons converge on one: **"it's already in the default path" is a dangerous free pass. If new code *claims* safety, that claim has to be *proven* in code.**

> **About this piece.** A work log verifiable in a public repo (Apache-2.0). What the review caught flaws in was not someone else's product but *our own harness,* and the fixes have shipped and are public. The security flaws the review found are written up as *lessons,* not exploit recipes. Same vein as [the heart of loop engineering is verification](/en/blog/loop-engineering-verifier-en/) and [the review tool caught its own author](/en/blog/review-tool-caught-the-author-en/).

## I thought it was simple

Some background. redteam is an **adversarial agent-pair harness.** One model writes the code, and a model from a *different provider* reviews the diff adversarially. Changes that touch a security boundary get a design review (`plan_review`) before implementation and a code review (`code_review`) after — each from a different provider.

The task was this. Because a non-default mode *doesn't commit* its work, the diff the reviewer sees (`base...HEAD`) and the final PR could miss **files newly created outside the source/test roots.** The fix looked obvious — reuse the commit helper the default mode already had, and just add a manifest. *Pattern replication.* Half a day, I figured.

## The split — "pre-existing, so split it out" vs "if you claim it, prove it"

Both sides agreed on the option quickly. The split was over two things — *where to draw the line between what to fix now and what to split out,* and *how strongly the implementer's claimed safety property has to be proven.*

My position (the implementer) was **"scope it down."** The default path is already vetted, so reuse its helper; the problem of an operator's own changes getting mixed in is a *pre-existing problem that's already in the default path,* so it belongs in a separate issue. For now, focus this task on the non-default mode.

The reviewer's position (a different provider) was different. **"Prove the invariant you claim, in code."** If the implementation *claims* it "never uses operator changes," then it has to block *every* path that breaks that claim. "It's also in the default path" is **not a free pass.** And a new trust input (the manifest is read from a state file) has to be *exhaustively* validated from a path-injection standpoint.

So we weren't split on an abstract principle. We were split on the **specificity of the attack surface.** I kept repeating "let's split that out," and every round the reviewer brought a fresh, concrete path that *bypassed* that split boundary.

## Each round surfaced a subtler bypass

After five design rounds got the design approved, the real tension began in the code review. The crux was one thing — **a single path read from a state file** was an input that must not be trusted. And that one input slipped past validation a *different way* each round.

I won't transcribe the exploits. But to show *how the grain deepened:*

- A seemingly-fine path string carried a **hidden control character** that passed validation and then split into two at a boundary, dragging in a file outside the intended scope → *reject control characters wholesale.*
- Committing by the whole index swept in **unrelated files the operator had pre-staged** → *commit only the named paths.*
- A text match was a **substring match,** so it caught more than intended → *make it an exact match.*

Each round I **reproduced the actual behavior in an empty git repo** (e.g., does the named-path commit handle deletions and leave the operator's staged files untouched?), then fixed it and added a regression test. Only after seven rounds did "no remaining findings → APPROVED" come out. The half-day task ended there.

Here's the part worth chewing on. We were talking about *the same single trust input* the whole time. But "I validated it" and **"I blocked every bypass"** were entirely different statements. The first took one round; the second took seven.

## Why 12 rounds — four lessons

**1. "It's already in the default path" is a dangerous free pass.** If new code *claims* a safety property, that claim has to be *proven* in code. You can't close a reviewer with "pre-existing." The right handling was to *document the boundary as an explicit split-out issue* — while **blocking, on the spot, any path that bypasses it.**

**2. A trust input needs exhaustive validation.** A single path read from a state file bypassed validation three-plus times, each a different way. The *intent* to "validate this input" isn't enough. It's validation only once you *close the bypasses one by one.*

**3. Cross-*provider* adversariality was load-bearing.** Had the same model reviewed its own code, it would likely have missed the escalating flaws across seven rounds. The side that wrote the code shares its own assumptions, so it can't see that assumption's blind spot. Being a *different provider* was decisive here.

**4. The simplicity trap.** Ironically, this "pattern replication" triggered *more* security rounds than anything else we'd processed. Precisely because it was a non-default mode, verification there had been looser. **The more trivial a change looks, the more that 'triviality' makes you skip the checking.**

## And what's left

To be honest: hardening the default path itself was **split into a separate issue** in this scope, and that issue is still open. But this is not an "unpatched security hole" — the orchestrator that runs this harness is a batch driver that usually runs on a *clean tree,* so the risk of that path being triggered in reality is low. Documenting the boundary as an *open issue* rather than hiding it is itself lesson 1 in practice.

## Takeaways

- **Don't be fooled by "it's already elsewhere, so it's fine."** Safety a new piece of code claims has to be proven in code. Leave the boundary as an explicit issue, not a free pass, and block the bypass path on the spot.
- **"I validated it" ≠ "I blocked every bypass."** A trust input is validated only when you close the bypasses exhaustively, not by intent.
- **Self-review can't catch it.** The side that wrote the code shares its assumptions' blind spot. A different *provider's* adversarial eye is load-bearing.
- **The more trivial it looks, the more you should suspect it.** Verification loosens not on the hard tasks but on the ones that *look easy.*

The change I'd figured for half a day took 12 rounds not because of a lack of skill. If anything, those 12 rounds were *evidence the adversarial verification worked.* Had it passed quietly, those subtle bypasses would still be sitting right there.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
