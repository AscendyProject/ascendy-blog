---
title: "How you call the second AI, and when to stop it — a headless adversarial review loop"
description: "Call the review agent as a headless subprocess with forced output, not by driving its screen — ending screen-parsing's fragility. And a human-drawn 'stop line' the reviewer judges converges it: 9→7→3→APPROVED."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["ai-agents", "code-review", "automation", "dogfooding", "developer-tooling", "convergence"]
category: "meta"
lang: "en"
translationKey: "headless-adversarial-review-loop"
sourceIntake:
  - "docs/intake/from-backend/2026-05-31-headless-adversarial-review-loop.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We pair an implementation agent with a review agent (a different model). Previously the reviewer ran in a **separate screen session** where a human pasted prompts and collected results via a sentinel file — manual relay, the biggest friction.
- We switched the reviewer from **driving its screen** to a **headless subprocess**. Prompt over stdin, a forced last line of `REVIEW_DECISION: APPROVED|CHANGES_REQUESTED` plus findings as IDs, and stdout parsed by machine. **Screen-parsing, the separate session, and the sentinel relay all vanished.**
- Adversarial review converges, but **asymptotically** — leave it alone and it demands ever-deeper spec. Let a **human draw the stop line and the reviewer judge its legitimacy**, and a design-doc review ended cleanly at **9 → 7 → 3 → APPROVED**.
- The defects that review caught (a layering violation, a non-atomic rate limit, swallowing an external API's failure as success, a secret nearly leaking into an error log, a guard that "only checks double quotes") were **the kind human review easily misses.**

> **Source note.** This post distills a backend-team intake (`docs/intake/from-backend/2026-05-31-headless-adversarial-review-loop.md`). Internal identifiers — the in-house harness, agent product names, the CLI name, module paths — are generalized. If [pairing two AIs made things slower](/en/blog/agent-os-dogfooding-journey-en/) is the evolution narrative, this is its "and here's what actually happened when we ran it" data.

## The real question wasn't "should we have it review"

We run a harness pairing an implementation agent (the one writing code) with a review agent (a different model). When people imagine automating AI code review, they picture "have the second model review it." But what actually got in the way wasn't *whether* to review — it was **how you call it**, and **when you stop**.

The old setup ran the reviewer in a **separate screen session**. A human pasted the prompt, the reviewer spat an answer onto the screen, and we read it back to collect results via a sentinel file. That manual relay was the biggest friction, and reading from a screen is inherently fragile — ghost text, timing, focus incidents.

## Drop screen control, go subprocess

Once we confirmed the reviewer CLI supports a **headless (non-interactive) mode**, we switched review from screen control to a **subprocess call**.

- The prompt goes over **stdin**.
- The output format is forced — a last line of `REVIEW_DECISION: APPROVED|CHANGES_REQUESTED`, and findings as IDs.
- **stdout is parsed by machine.**

That single switch made screen-parsing, the separate session, and the sentinel relay **vanish entirely.** And as a bonus, a boundary clarified — a **collaborator** (a live agent in another repo, accumulating context) and a **review function** (a stateless call that examines the same work) are different things. The former should be a live session; the latter you call like a function and discard. Only the latter belongs in a headless call.

## Adversarial review converges — but only with a stop line

We reviewed this round's changes with that loop. Running one design doc through four rounds was striking.

| Round | `CHANGES_REQUESTED` items |
|---|---|
| 1 | 9 |
| 2 | 7 |
| 3 | 3 |
| 4 | **0 — APPROVED** |

Both item count and token usage decreased monotonically. The key was round 3. The reviewer **explicitly accepted the human-drawn boundary — "this is a design doc; field-level spec is decided in the implementation PR" — and stopped re-demanding deeper spec.**

That's the key to convergence. Left alone, adversarial review **demands ever-deeper detail** — it converges asymptotically but never actually ends. Let a human draw the stop line ("ideation is direction, the implementation PR is spec") and have the **reviewer judge that line's legitimacy**, and it ended cleanly in four rounds. You don't command the reviewer to "stop" — you ask "this is where this document's responsibility ends; do you agree?"

## And it caught real defects

One PR (a new API endpoint) went up without a review gate, "because it's simple." The headless review caught, step by step:

- **A layering violation** — the router calling an infrastructure client directly
- **A non-atomic rate limit** — could permanently block on a crash
- **Swallowing an external API's 4xx/5xx as success**
- **A secret nearly leaking into an error log** (fixed immediately in the same PR)

The other PR (a refactor) surfaced something more interesting. A "no hardcoding" guard test I'd added had a hole — it only checked double quotes (single quotes passed) — and the reviewer **reproduced it directly, in code.** So we rewrote the guard on an AST basis. That's the value of *proving* a finding rather than just stating it.

What these defects share: **the more "simple-looking" a change, the bigger the cost of skipping the review gate** — and layering violations, secrets in logs, and quote-only static checks are all the kind human review easily misses.

## Takeaways

- **Call the second AI as a headless subprocess with structured output (`REVIEW_DECISION`/finding-id), not by driving its screen.** Receiving results over stdout/files is overwhelmingly more robust than screen-parsing.
- **Distinguish a "collaborator" from a "review function."** A live context-accumulating agent and a call-once-and-discard stateless review are different; only the latter goes headless.
- **For adversarial review, let a human draw the stop line and ask the reviewer to judge its legitimacy.** A boundary like "ideation vs implementation spec" cuts off infinite refinement.
- **Even "simple-looking" changes that cross a boundary (a new API, a multi-module refactor) shouldn't skip the review gate.** Automated review catches, as data, the defects humans miss.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
