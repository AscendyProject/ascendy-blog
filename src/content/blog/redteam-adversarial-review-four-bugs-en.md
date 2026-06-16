---
title: "We let one AI review another AI's PRs — it caught four HIGH bugs before merge"
description: "In redteam's 0.3 cycle, a different-provider model reviewed another AI's PRs and caught four HIGH defects — all ~95% correct, one security detail missing. The kind self-review rubber-stamps. Not a benchmark, a merge log."
pubDate: 2026-06-16
author: "Ascendy Engineering"
tags: ["adversarial-review", "ai-agents", "code-review", "redteam", "trust", "semver"]
category: "meta"
lang: "en"
translationKey: "redteam-adversarial-review-four-bugs"
sourceIntake:
  - "docs/intake/from-redteam/2026-06-16-version-bumps-and-adversarial-review.md"
draft: false
redactionReviewed: true
---

## TL;DR

- During the 0.3.0 cycle of **redteam** (an adversarial agent-pair harness, Apache-2.0), a batch of PRs written by one AI agent was reviewed, PR by PR, by a **different-provider** model — the harness's own premise, applied to its own development.
- The agent-written code was genuinely good. Yet the cross-provider reviewer caught **four real HIGH-severity defects before merge**, and **all four were the same shape**: *~95% correct, one security/correctness detail missing.* (This is stated directly in [the 0.3.0 CHANGELOG](https://github.com/AscendyProject/redteam).)
- The point: these aren't dumb bugs. They're the kind a competent author — human or AI — ships because the happy path passes and the tests are green. And they're exactly what a model reviewing *its own* output tends to rubber-stamp.
- Not a benchmark — **the project's own merge log.** (N=one: not statistical proof, just "this caught real, expensive-to-find defects here.")

> **Source note.** Distilled from a redteam-team intake. It's all public OSS (`AscendyProject/redteam`, Apache-2.0), so the canon comes straight from the public CHANGELOG, issues, and PRs. Same *adversarial review* vein as [the redteam launch post](/en/blog/redteam-launch-en/), [two AIs picked the same answer — the value was catching the wrong reasoning inside it](/en/blog/right-answer-wrong-reasoning-en/), and [how to call the second AI and when to stop it](/en/blog/headless-adversarial-review-loop-en/).

## The version numbers tell the story

A pre-1.0 tool's version numbers usually read as noise. redteam's don't — **0.2.0 and 0.3.0 tell a two-act story about what it takes for an AI-built tool to become trustworthy.**

- **0.1.0 — it exists.** Extracted into a standalone OSS repo, proven generic on a non-Python stack, plugin-packaged. *"Can this thing run at all, anywhere?"*
- **0.2.0 — it has opinions.** The features that encode the thesis. The headline: a **fail-closed guard against same-provider self-review** — the harness refuses to review code from *its own provider.* The belief that an adversarial pair must stay cross-provider, wired in as structure, not a request. *"What does it believe, and can a user drive it?"*
- **0.3.0 — it survives itself.** Here's the punchline. *Using* the 0.2 capabilities (dogfooding) surfaced everywhere they could fail, so 0.3 is almost entirely **fail-closed backstops and operator visibility** — a reviewer fallback ladder, a dispatch-time invariant that pins the verification snapshot, a version stamp that tells a vendored copy it's behind, an operator progress surface for long/detached runs, and a batch of "fail closed, don't fail open" fixes.

**The throughline:** v0.2 is "the feature works." v0.3 is "the feature survives the messy real world the feature itself exposed." For agent-built software that gap is the whole ballgame. The first version that does the happy path is easy. **The version that refuses to do the *wrong* thing under failure** is the one you can trust.

And what proved 0.3 "survives itself" is exactly what happened during this cycle.

## One AI's PRs, reviewed by another AI

redteam's premise is simple — one model writes code, a **different, independent model** reviews the diff adversarially, and humans gate the irreversible steps. Building 0.3.0, it applied that premise **to itself.** The 0.3.0 code was written by one AI agent and reviewed, PR by PR, by a model from a **different provider.**

The result is pinned in [one CHANGELOG line](https://github.com/AscendyProject/redteam):

> "Every change landed through the harness's own cross-provider adversarial review (Codex reviewing Claude-written code), which caught **four real HIGH-severity defects before merge.**"

The agent-written code wasn't bad — it was good. The problem is that all four defects were the **same shape**: *~95% correct, one security or correctness detail missing.*

## The four defects (all on the public repo)

> The specifics below are from the redteam team's review log. Each traces to a public issue / fix PR.

1. **A "plug the hole" hardening that left a hole exactly where it claimed to close one (issue #39).** A pre-implement snapshot hardening meant to block tree mutations before `implement` — but it **omitted one field** of the thing it was hardening, so a partial state could still mutate the tree past the gate.
2. **A human-readable progress file that could have leaked a secret (issue #49).** The operator `progress.md` mirrored a **raw reviewer line** verbatim — and that line could quote a secret. Fixed to render only structured, bounded fields.
3. **A gate whose entire job is to fail closed, failing open (issue #50).** In a commit-integrity gate, **a failed git probe was read as "clean."** The whole reason the gate exists is to block safely — and it opened on the failure path.
4. **An auth preflight that leaked credentials (issue #51).** A PR-auth preflight leaked **credentialed remote URLs and stderr** into persisted state.

## Why this is the argument for cross-provider review

None of the four are dumb bugs. They're what a competent author — human or AI — ships because the happy path passes and the tests are green. More precisely, they're exactly the kind **a model reviewing its own output tends to rubber-stamp.** When you read your own code, the gaps in your own reasoning are just as invisible the second time.

So the crux is that a **different model — blind to the author's reasoning and prompted to refute — caught all four.** Defects that self-review ("look again") would have waved through, a *different* model's eyes caught. That's the argument for cross-provider adversarial review in one paragraph — and it's not a benchmark, it's the project's own merge log.

## Honestly — this is N=one

It's right not to overclaim. This is **one project's one cycle**, not a controlled study. The claim is "this caught real, expensive-to-find defects here," not "cross-provider review is statistically proven superior." Stating the sample size plainly is on-tone for this post.

And to keep roadmap separate from shipped — the work to make the reviewer more pluggable (a sub-agent reviewer adapter, rejecting terminal-multiplexer screen-scraping) **isn't built yet.** What landed in 0.3 is the **fallback-ladder step** of it (issue #37). The rest is roadmap, not "it exists."

## Takeaways

- **In AI-built software, the version you can trust isn't the happy-path one — it's the one that refuses to do the wrong thing under failure.** The gap between v0.2 (the feature works) and v0.3 (it survives the mess the feature exposed) is the whole game.
- **Defects aren't dumb.** The most dangerous kind is *~95% correct, one detail missing*, shipped by a competent author because the tests are green. The happy path won't catch it.
- **Self-review can't catch that kind.** The gaps in your own reasoning are invisible to you the second time too. You need a *different* model, blind to the author and told to refute.
- **A merge log is enough evidence — if you state N=one honestly.** "We caught this here" is weaker than "it's generally superior," but it's more honest and more verifiable.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
