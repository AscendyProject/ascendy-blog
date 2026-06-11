---
title: "When a reviewer just says 'looks good,' what's the point? — introducing redteam, an adversarial agent-pair harness"
description: "Hand review to a second model and you often get 'looks good' — a rubber stamp. redteam (open source, v0.1.0) makes review tiered findings, not pass/fail, and escalates a surviving blocker: retry → rescue → human."
pubDate: 2026-06-10
author: "Ascendy Engineering"
tags: ["ai-collaboration", "adversarial-review", "open-source", "developer-tools", "agent-harness"]
category: "meta"
lang: "en"
translationKey: "redteam-launch"
sourceIntake:
  - "docs/intake/from-redteam/2026-06-10-redteam-launch.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We're open-sourcing **redteam** (v0.1.0, Apache-2.0). It's an **adversarial agent-pair harness**: one model writes code through a test-first pipeline (plan → test → implement), a **different, independent model** reviews the diff adversarially, and humans gate the irreversible steps.
- The lead differentiator ⭐: **review isn't pass/fail.** The reviewer tags each finding with a severity (blocker/major/minor), and the orchestrator tracks it **across rounds**. A surviving blocker climbs: **retry → a heavier `rescue` pass → a human.**
- The effect: one rejection doesn't kill a run, and **a stubborn real bug doesn't slip through on a single retry.**
- Honestly: it's **early (v0.1.0).** Automatic tier-routing is on the roadmap (#13), not in this release.

> **Source note.** The canonical source for this post is the public repo ([AscendyProject/redteam](https://github.com/AscendyProject/redteam)); the facts were pulled straight from its README and v0.1.0 release note at publish time, with the redteam team's engine fact-check applied. The pattern we've written about before — [how you call the second AI, and when to stop it](/en/blog/headless-adversarial-review-loop-en/), [two AIs picked the same answer](/en/blog/right-answer-wrong-reasoning-en/), [pairing two AIs made things slower](/en/blog/agent-os-dogfooding-journey-en/) — is now extracted into a single tool.

## The problem — a second model rubber-stamps too

Have one model write the code and then **review its own code**, and it usually passes. It's hard to doubt a decision you just made. So "add a second model" is the natural next move.

But a second model has its own trap. Throw it a diff and say "review this," and quite often you get back **"looks good."** Models are good at agreeing. Whether that "looks good" is a *review* or a *rubber stamp*, you can't tell from the output alone.

The question is this: **what does it take to make review actually *act*?** redteam's answer is in the *shape* of the review.

## The answer — tiered findings + an escalation ladder

In redteam, review isn't pass/fail. The reviewer attaches a **severity** to each finding — `blocker` / `major` / `minor`. And the orchestrator tracks those findings **across multiple rounds.** "Tracks" is the key word — it doesn't end on a single round's verdict; it watches whether the same finding is still alive next round.

A surviving `blocker` **climbs the ladder.**

```text
blocker survives multiple rounds →  retry the worker
                                 →  a heavier rescue pass
                                 →  a human gates the rescue result (deferred to an operator if unrecoverable)
```

(Separately, a block at the *plan* stage stops the harness and asks the operator directly.) This structure blocks two opposite failures at once.

- **One rejection doesn't kill a run.** Even if the reviewer blocks once, the worker gets a chance to fix it. It avoids the over-sensitivity of "the reviewer might be wrong, but the whole thing halts anyway."
- **A stubborn real bug doesn't slip through.** A blocker not fixed on one retry doesn't vanish — it goes to a *heavier pass*, and finally to a *human*. It plugs the leak of "rejected once, then forgotten next round."

This is what separates redteam from a plain "two-model" setup. Most treat review as just *pass/fail*; redteam carries each finding *with its severity, along a time axis*.

## Separation as structure — the reviewer is blind to the writer

For the tiered ladder to work, the review has to be genuinely adversarial. redteam enforces that by *structure*.

The reviewer is a **fresh agent**, can be a **different model** by config, and sees **the change (diff) and the task spec + security checklist** — but **not the implementer's reasoning.** There's no channel for the writer to plead "here's why I did it this way." The reviewer sees only the artifact and its spec, and judges on its own terms.

And **humans gate the irreversible steps** — plan approval and PR creation are blocked until a human approves. The agents propose; the human opens the doors you can't take back.

## Scale effort to risk

redteam isn't a tool for every change. It's the **heavyweight path** — not for fixing typos, but for the changes that are *expensive to get wrong*: **guarded** ones (auth, storage, concurrency, public APIs) and **strategic/architectural** ones.

Two levers match effort to risk.

- **Model per role** — bind a model to the worker and the reviewer separately in `.redteam/config.toml`. A cheaper implementer for routine work, a frontier reviewer for guarded work.
- **The escalation ladder** — the severity-driven climb to heavier passes, above.

**To be honest:** routing that looks at a change's nature and *automatically* picks the right tier is a good picture — but it's on the **roadmap (#13), not in this release.** v0.1.0 hands you the levers; it doesn't pull them for you yet.

## Model freedom

You can put **Claude or Codex** on either side — worker or reviewer (configured per role). One writes, a different one reviews, and which model takes which role is up to you. That collision we described in [two AIs picked the same answer](/en/blog/right-answer-wrong-reasoning-en/) — where even at the same conclusion the second model attacks the *reasoning* — is something you can run with different model pairings.

## Try it

redteam has **no runtime dependencies** (stdlib-only, project-agnostic) and installs vendored. It's early (v0.1.0), but it was **extracted from a private monorepo where it drove real, merged PRs**, and cross-stack validated on a Nuxt/Vue/TS frontend. APIs and layout may still move.

```text
# Claude Code plugin (recommended)
/plugin marketplace add AscendyProject/redteam
/plugin install redteam@ascendy-redteam
/redteam:redteam-install

# or vendor into any stack
python3 .redteam/scripts/install.py /path/to/your/project
```

License is **Apache-2.0**; contributions under a CLA (which keeps provenance clean and preserves the option of offering the project under other terms). Repo: [github.com/AscendyProject/redteam](https://github.com/AscendyProject/redteam).

## Takeaways

- **Adding a second model isn't enough.** "Looks good" can be a rubber stamp, not a review. To make review *act*, you need its shape — severity, round tracking, escalation.
- **One rejection shouldn't kill a run, and a stubborn bug shouldn't pass on a single try.** The escalation ladder (retry → rescue → human) blocks both at once.
- **Separation must be structural.** The reviewer can't see the writer's reasoning, is a different model, and humans gate the irreversible steps.
- **Match effort to risk.** redteam is the heavyweight path for guarded/strategic changes. (Auto-routing is roadmap #13 — for now you pull the levers by hand.)

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
