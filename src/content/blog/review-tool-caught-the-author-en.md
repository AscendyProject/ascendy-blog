---
title: "My review tool could approve nothing — then it caught me"
description: "redteam's one-off review could never return APPROVED — a dead gate. After I fixed it, the tool caught a flaw I'd just defended as an 'improvement.' An author's certainty can't cross another provider's review."
pubDate: 2026-06-28
author: "Ascendy Engineering"
tags: ["adversarial-review", "dogfooding", "redteam", "cross-provider", "agent-pair"]
category: "meta"
lang: "en"
translationKey: "review-tool-caught-the-author"
sourceIntake:
  - "docs/intake/from-redteam/2026-06-25-review-tool-caught-the-author.md"
origin:
  project: "redteam (Apache-2.0)"
  repo: "https://github.com/AscendyProject/redteam"
  summary: "redteam is a multi-model cross-review harness that forces code written by one model to be reviewed adversarially by an independent model from a different family. Every event in this post is a public-repo issue or PR."
draft: false
redactionReviewed: true
---

## TL;DR

- The *one-off cross-review command* of our open-source harness [redteam](https://github.com/AscendyProject/redteam) was, it turned out, a **dead gate that could never return APPROVED on any branch.** No matter how clean the code, it only ever returned `CHANGES_REQUESTED`.
- The cause was almost absurdly simple — the command inherited a *pipeline-only check* that looked for files that couldn't exist. **When a fail-closed gate inherits a premise it can't satisfy, it becomes a permanent rejector.**
- After fixing it, I had the fixed tool review *the fix itself* and it passed (dogfood). And right after — the same tool caught **a design flaw I had, moments earlier, defended with confidence as an "improvement."**
- That's the heart of this post. Not "a second model says *looks good* once more," but **an author's self-justification failing to cross another provider's boundary** — actually happening.

> **About this piece.** Every issue, PR, and review here is an event in a public repo (Apache-2.0). Same *adversarial verification* vein as [the heart of loop engineering is verification](/en/blog/loop-engineering-verifier-en/) and [the model I trusted most led me into a dead end](/en/blog/trusted-model-dead-end-en/).

## A reviewer that could pass nothing

I was clearing out a stack of engine PRs. The rule was simple — *"if it passes cross-model review, merge it."* So I ran the one-off review command. The result was strange. The code assessment was clean (no regressions), but the final decision was `CHANGES_REQUESTED` every time.

The reason wasn't about the code. *"Can't find verification.log. Can't find state.json."* It was rejecting over some missing file. That's when it hit me — **this command could never return APPROVED on any branch.** The docs clearly said "exit 0 means APPROVED, you can use it as a CI gate," and that was *structurally impossible.*

## When fail-closed inherits an unsatisfiable premise

The cause was simple. redteam has two review surfaces. One is the *pipeline* — a per-task state machine runs, leaves artifacts like `verification.log` and `state.json`, and the reviewer checks them as "required." The other is the *one-off review* — a surface that, outside the state machine, just says "review this branch's diff cross-model."

The problem: the one-off review inherited the *pipeline-only required checks.* In one-off mode those artifact files *cannot exist by design.* So the reviewer rejected, fail-closed, over "required files missing" — before even looking at the code.

There's a general lesson here — **when a fail-closed gate inherits a premise it can't satisfy, it isn't a safety mechanism, it's a permanent rejector.** "When in doubt, block" is right; but if you make the *grounds for doubt* a condition that *can never be met,* the whole gate dies. It's a trap that applies to any harness, any CI.

## Fix it — then verify the fix with the tool itself

I scoped the fix narrowly. I told the one-off review: *"This is a standalone review with no task artifacts. Don't apply those required checks, and don't reject because the files are missing. Judge by the diff alone — the security checklist, the hard rules, regressions, and the rule that any newly added test must fail before the change."* I *didn't touch* the pipeline's verification gate or the self-review guard. I loosened exactly one premise that can't hold in one-off mode.

And then — *I had the fixed tool review the diff of that very fix.* The result was `APPROVED` (no regressions, confirmed the new test fails before the change). **I verified the fix using the fixed tool.** That a verification tool becomes a dead gate unless you dogfood it — I reconfirmed with a tool that had just died and come back.

## The moment it recovered, it caught me

This is where it gets real. Next I used the same tool to review *a different change* — a feature for configuring models per role.

In that implementation, I'd applied the self-review guard (which prevents author-equals-reviewer collapse) not just to the `reviewer` role but also to the `rescue` role. And in my own review notes I *defended* it: "the runtime guard only checks the reviewer, but my CLI checks rescue too. **It's a parity improvement.**" I was confident.

With the fixed tool, Codex refuted it the moment it saw the diff. **At runtime, `rescue` is not a headless reviewer.** The rescue stage only validates a human-written report; it doesn't even call the reviewer adapter — it's explicitly excluded from the reviewer phases. So forcing a "must be cross-provider" invariant onto rescue **becomes a regression that rejects a supported, valid configuration.** A user wanting to swap author and reviewer in the default pair gets blocked — for a config that runs perfectly fine.

*What I'd called an "improvement" was actually a regression.* And the one who saw it was neither me, who wrote the code, nor my own review notes. **Only a reviewer from a different provider saw it.** (That config feature was ultimately closed by a different PR with a cleaner implementation — one that never had this trap by construction.)

## Why this is the core of redteam

redteam's premise is one sentence — *"the model that wrote the code must not be the one to judge whether it's safe."* This event showed it in two layers.

First, **the verification tool itself was broken, and that only surfaced *when I tried to use it.*** A tool doesn't live by being built; it lives by being *used.*

Second, once the tool recovered — a judgment I had *defended with confidence* collapsed in front of another provider. This is the point. Cross-model review is worth the most not when the author is *unsure* but when they're **certain.** Code you suspect is wrong, you'll re-check anyway. The dangerous code is the code you *believe* is right. And what stops that self-justification isn't a second glance from the same head — it's a glance from a *different family, with no reason to agree.*

## Takeaways

- **A verification tool becomes a dead gate unless you dogfood it.** Whether a gate you built can actually *issue* a pass or a fail — you don't know until you run it.
- **A fail-closed gate that inherits an unsatisfiable premise becomes a permanent rejector.** If the grounds for "when in doubt, block" are *impossible to meet,* it's a wall, not a gate.
- **Cross-model review is worth the most when the author is certain.** And to break that certainty, the reviewer must be from a *different family.*

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
