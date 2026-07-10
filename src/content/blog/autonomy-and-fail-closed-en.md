---
title: "Autonomy and fail-closed don't conflict — my harness started running itself"
description: "I made my harness autonomous — give it one goal and it runs to completion, and it even cut its own release. But autonomy didn't mean removing review; I added a layer. Adversarial layers still caught real bugs mid-run."
pubDate: 2026-07-11
author: "Ascendy Engineering"
tags: ["ai", "agents", "code-review", "autonomy", "fail-closed", "opinion"]
category: "meta"
lang: "en"
translationKey: "autonomy-and-fail-closed"
sourceIntake:
  - "docs/intake/from-redteam/2026-07-05-autonomy-and-fail-closed.md"
draft: false
redactionReviewed: true
---

## TL;DR

- I made our open-source review harness [redteam](https://github.com/AscendyProject/redteam) **run autonomously.** Give it one goal and it drives decompose → implement → review *to completion by itself* — and it even cut its own release (v0.7.0).
- But adding autonomy didn't mean *removing* review. If anything I **added a layer.** The crux: **autonomy and fail-closed are not opposites.**
- How: delegate *only the mechanical, judgment-free steps,* and hard-stop the real decisions (scope, security boundaries) back to a human. And while running autonomously, **adversarial layers still caught real bugs** — to the point that even the *document granting the agent autonomy* got caught in cross-model review.
- Honestly: this isn't "fully autonomous." A human touches the start (writing the goal) and the end (merging), and we hand-patched engine gaps that surfaced mid-run. And *those patches became the material for the next improvement.*

> **About this piece.** A real work log, verifiable in a public repo (Apache-2.0). I tried not to overclaim — I use the word "autonomous," but I also mark where the human still is. Same vein as [the heart of loop engineering is verification](/en/blog/loop-engineering-verifier-en/) and [the review tool caught its own author](/en/blog/review-tool-caught-the-author-en/).

## Autonomy and fail-closed are not opposites

When people hear "give the agent autonomy," they usually picture *"remove the gates and let it go."* But building the harness to run autonomously taught us the opposite.

**The way to add autonomy isn't to remove review — it's to delegate only the judgment-free work and add one more layer.** This piece is about how those two faces — *autonomous execution* and *thicker defense* — are the front and back of the same design.

## Give it one goal and it runs to completion — the autonomous driver

First, the autonomy side. The old harness ran "decompose and start" once, then stopped. Every time the pipeline stalled, a human had to open the state file and diagnose it. That was the real pain point.

So we redesigned it into a **driver that runs to completion from one goal.** Now you throw it a single goal and the agent:

1. Reads the state (which task is stuck, why it was deferred),
2. Diagnoses it,
3. Takes **only the permitted actions** itself (recover transient infra, clean up a stale branch, resume a deferral whose cause is gone, fix a misworded brief),
4. Resumes.

— looping until every task's draft PR is open.

Two things keep it fail-closed here.

- **It never merges.** Draft PRs pile up on a stack, and *merging is the one checkpoint left to the human.*
- **Real decisions are a hard stop.** When decomposition itself should be refused, when the same task is deferred twice for the same reason, when a security boundary is touched — the agent stops and hands it back. *What we delegate isn't judgment; it's the mechanical steps between judgments.*

## The harness cut its own release

The same principle reached the release. This time the harness left its **first case of cutting its own release (v0.7.0).** The previous version was tagged by hand; this time, once the release PR merged, the workflow checked version consistency, waited for a single human **approval click,** and then finished the tag and release notes automatically.

The point isn't *"automation replaces judgment."* The opposite — **it keeps only the human decisions (merge, approval click) and removes every mechanical step *between* those decisions.** If the versions drift, it blocks (a drift guard); if you aren't the approver, it blocks (an actor gate). Automation aimed *not at erasing judgment, but at erasing the chores.*

## But — I didn't remove review; I added a layer

That's the autonomy side. Here's what I actually wanted to talk about. As it started running autonomously, we **added an adversarial layer, not removed one.** And it paid off. Three scenes.

### Scene 1 — even the document *granting* autonomy got caught in review

We wrote a permissions playbook that tells the autonomous driver "in this situation, you may do this." A draft clause said *"delete stale branches."*

A cross-model reviewer (a different family than the model that wrote the code) flagged it as major. *"The engine defers rather than deletes when a guard trips. Letting the agent delete unconditionally is a data-loss path for work that hasn't been merged yet."* So the clause became *"delete only after confirming it's an ancestor commit; otherwise rename it aside."*

The lesson is sharp. **Even the document that grants an agent autonomy has to pass adversarial review.** The moment you widen a permission is the moment to make the defense thickest.

### Scene 2 — the scope of the review decides the quality of the review

One task **passed** the pipeline's cross-model review as APPROVED. But a **stack-integration review** run *afterward* — a layer that adversarially re-examines not just that one task but the whole accumulated stack — caught an integrity flaw.

Why didn't the per-task review see it? That review only looks at *its own task's changes.* But this flaw arose from the *interaction* between a new exception rule and how commits are attributed — invisible from one task alone, and only visible **across the whole stack.**

Even the fix kept the principle. Instead of patching inline (a security boundary, and the worker and operator share a model), we *sent the flaw back to the worker as review feedback* to fix, and a different model verified it again. **The judge stayed a different model to the end.**

Lesson: even when every per-task gate passes, *a layer that adversarially re-reads the whole combined result* pays off. **The scope of the review decides its quality.**

### Scene 3 — fail-closed lives in the worker's *refusal* too

One task's requirements contained two mutually contradictory items: *"pass the existing tests without touching them"* and *"change the very rule those tests pin down."*

The worker doing the implementation **refused three times in a row and reported the contradiction.** It didn't take the path of forcing a pass (e.g., quietly editing the tests to make them green). Only after a human resolved the contradiction did it proceed.

**Fail-closed doesn't live only in the gates. It lives in the worker's refusal.** When blocked, stop and report instead of forcing through — that's the property an autonomous agent needs most.

## Honestly — this isn't "fully autonomous"

I won't overclaim. The runs above are **not fully autonomous.** A human touched the start (writing the goal) and the end (merging the PRs), and we hand-patched the engine's gaps that surfaced mid-run.

But here's the interesting part — **those patches became the material for the next improvement.** A spot where an autonomous run got stuck becomes an issue, that issue gets fixed (partly) autonomously again… and the loop turns. The accurate picture isn't "fully autonomous" but **"autonomous + human cleanup, where the cleanup becomes the next material."**

## Takeaways

- **Autonomy and fail-closed are not opposites.** The way to add autonomy is to delegate only the judgment-free work and *add a layer,* not remove the gates.
- **What you delegate isn't judgment — it's the chores between judgments.** The autonomous driver and the release automation both keep only the human decisions and remove the mechanical steps between them.
- **The moment you widen a permission is the moment to thicken the defense.** Even the document granting autonomy has to pass adversarial review.
- **The scope of the review decides its quality.** After per-task passes, a layer that adversarially re-reads the whole combined result pays off.
- **Fail-closed lives in the worker's refusal too.** When blocked, stop and report instead of forcing through.

Autonomy isn't "removing the human." It's closer to *knowing more precisely where the human has to stay.* The more precisely you leave that seat, the more boldly you can delegate the rest.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
