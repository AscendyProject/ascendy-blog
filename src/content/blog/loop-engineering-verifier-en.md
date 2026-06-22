---
title: "The heart of loop engineering is verification — and the verifier must be a *different* model"
description: "Prompt → context → harness → loop engineering. The 2026 axis is the loop, and an autonomous loop is only as good as its verifier. Since a model judges its own work poorly, that verifier must be a different model."
pubDate: 2026-06-22
author: "Ascendy Engineering"
tags: ["loop-engineering", "agents", "adversarial-review", "redteam", "oss"]
category: "meta"
lang: "en"
translationKey: "loop-engineering-verifier"
sourceIntake:
  - "docs/intake/from-redteam/2026-06-22-redteam-as-loop-engineering.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Working with AI agents evolved **prompt → context → harness → loop engineering** — at least, that's the lineage the writeups cited below lay out. **Loop engineering** — a framing that spread fast in June 2026 — is *designing the loop that runs an agent on its own, instead of prompting it turn by turn.*
- An autonomous loop has triggers, goals, actions, verification, and memory — but the one thing that lets you *walk away and delegate* is the **verification gate.** As one writeup ([Cobus Greyling](https://cobusgreyling.medium.com/loop-engineering-62926dd6991c)) puts it: *"In an unattended loop, the verifier is what lets you walk away *with some confidence.*"*
- And the core principle of verification is sharp: **"the agent that wrote the code is a poor judge of its own work"** (maker/checker). Let a model verify its own output and it rubber-stamps. → **The verifier has to be a *different* model** — and *this post's argument* is that you should go one step further, to a different *provider.*
- Our adversarial agent-pair harness **redteam** (Apache-2.0) is a worked example that pushes exactly that point to the end — its verification gate is **cross-provider adversarial + fail-closed.** (Not a claim that redteam is the *best* loop — just that this is what building the *heart* of a loop seriously looks like.)

> **Source note.** The lineage and definition of loop engineering are checked against public sources ([Cobus Greyling](https://cobusgreyling.medium.com/loop-engineering-62926dd6991c), [explainx](https://explainx.ai/blog/what-is-loop-engineering-ai-agents-2026)). redteam's behavior is public OSS (`AscendyProject/redteam`), verified from its README and CHANGELOG. Same *adversarial verification* vein as [how to call the second AI and when to stop it](/en/blog/headless-adversarial-review-loop-en/) and [how to reject a feature](/en/blog/how-to-reject-a-feature-en/).

## From prompt to loop

The lineage of driving AI, as these loop-engineering writeups lay it out, runs in four stages.

- **Prompt engineering** — *what you type.* Writing a single instruction well.
- **Context engineering** (2025) — *what the model sees.* Laying out enough context for the task to be solvable.
- **Harness engineering** (early 2026) — *where the model runs.* Everything outside the model — the tools, the constraints, the feedback, the validation gates.
- **Loop engineering** (June 2026) — *what drives the model.* You no longer prompt it turn by turn. **You design the *loop*: the agent discovers work, delegates it, verifies results, persists state, and decides the next action — on its own.**

The question shifts from *"what should I say?"* to ***"what system do I build so the agent works independently?"*** Once models could run autonomously for hours, the bottleneck moved from *model capability* to *orchestration design.*

## An autonomous loop is only as good as its verifier

A loop is usually described as: a **trigger** (schedule/event), a **verifiable goal**, **actions** (tools), **verification**, and **memory** (state). But one of these is the genuinely hard part.

**The verification gate.** The line from one writeup ([Cobus Greyling](https://cobusgreyling.medium.com/loop-engineering-62926dd6991c)) that captures it:

> *"In an unattended loop, the verifier is what lets you walk away *with some confidence.*"*

Of course. If the agent runs for hours *without you,* the only thing that makes its output trustworthy is *verification.* When the verifier is weak — *"without verification, loops either run forever or stop too early."* The entire value of autonomy rides on one verifier.

## But if the verifier is *itself,* it collapses

The core principle of verification is sharper still. The loop-engineering canon states it plainly:

> *"The agent that wrote the code is a poor judge of its own work."* (the maker/checker split)

Read your own code and the gaps in your own reasoning are just as invisible the second time. You *pass* it. So a good loop **separates the maker from the checker** and verifies with *different instructions (and often a different model)* — that much is canon.

***From here it's this post's argument.*** If the checker is a sub-agent of *the same provider,* it's close to a variant of self-review — because same-family models can share the same blind spots. So independence should be pushed to the *provider boundary.* That's redteam's design choice, not something the canon requires.

## redteam — wiring the verification gate cross-provider, adversarially

[**redteam**](https://github.com/AscendyProject/redteam) (our adversarial agent-pair harness, Apache-2.0) is a loop that pushes exactly that gate to the end. Three things.

1. **The verifier is a *different provider.*** One model drives the code through a pipeline (`plan → implement → review`); a model from a **different vendor** reviews the diff *adversarially.* The shipped default: **Claude writes, Codex reviews** (reversible by config). It lifts maker/checker to *cross-provider.*
2. **Self-review is refused, fail-closed.** If a model from the *same provider* tries to review its own code, the harness **blocks it, fail-closed.** The path of "passing as if it were a different sub-agent" is closed by structure.
3. **Findings are tiered, not pass/fail.** The reviewer emits severity-tagged findings, and the common path runs *with no human gate* all the way to **opening a draft PR** — because **the adversarial pair plus verification *is* the trust.** (That draft PR is the human checkpoint before merge; the harness *never autonomously merges.*)

And this is backed by a *record,* not a slogan. redteam's CHANGELOG states it in one line — **"cross-provider adversarial review caught four real HIGH-severity defects before merge."** What the CHANGELOG confirms is that a *different* model caught those four; that *self-review would have rubber-stamped them* is this post's reading.

## The rest of the loop is there too

It isn't only the verifier. Every component the loop-engineering canon lists is present.

- **Memory / state persistence** — it persists `state.json` after each phase, so an interrupted loop *resumes* instead of *spinning.* (*"Memory is what separates a loop that learns from one that spins."*)
- **Verifiable goal** — TDD mode front-loads `write_test → verify_test`, making the goal *checkable.*
- **Fail-safe / stopping conditions** — if a blocker persists across review rounds, `human_gate_rescue` hands it to a person. If the primary reviewer fails on *infrastructure* (missing CLI, timeout), a fallback ladder degrades fail-closed.
- **No cognitive surrender** — for risky changes (auth, storage, concurrency, migrations), **tier-aware routing** auto-re-attaches human gates (`review/gates/models` toggles), combined with the operator policy of *requiring a rollback plan* for production-critical changes — exactly the *"cognitive surrender"* the canon warns against, blocked by structure.

## Loop design includes *deciding not to build*

One telling detail. The loop-engineering writeups say to *use* sub-agents — but in one cycle redteam **rejected an adapter that spins up a sub-agent reviewer inside the session.** The reason is precisely point 2 above: a same-session sub-agent raises the risk of *same-provider self-review* collapse. So it chose headless cross-provider instead, and left the rejection as a decision record. ([How to reject a feature](/en/blog/how-to-reject-a-feature-en/)) Loop design is as much about *what you don't add* as what you do.

## Takeaways

- **The more autonomous the loop, the more the verifier is everything.** The one thing that lets you walk away and delegate is verification.
- **If that verifier is *the same model,* it collapses quietly into self-review — and this post extends that risk to the *same provider* too.** Same-family models can share blind spots; it *feels* like consensus, but the check is empty.
- **So the next frontier of loop engineering, *as I see it,* is *cross-provider adversarial verification.*** Make the checker a *different vendor,* told to *refute,* and you catch the defects self-review would likely pass.
- redteam is *one* example that wires that into the engine. Not a claim to be *the best* — just a checkable example of what building the *heart* of a loop seriously produces.

Repo: [github.com/AscendyProject/redteam](https://github.com/AscendyProject/redteam) (Apache-2.0).

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
