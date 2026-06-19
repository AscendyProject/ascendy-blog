---
title: "Why you can't trust an LLM's score — lock the band, let the model judge only inside it"
description: "LLM scores wobble on the same input. portfolio's /fit and /rating lock the grade band in deterministic code and let the model judge only inside it — the reproducibility guarantee is the band, not temperature."
pubDate: 2026-06-19
author: "Ascendy Engineering"
tags: ["grounding", "ai", "determinism", "evaluation", "developer-tools"]
category: "meta"
lang: "en"
translationKey: "hybrid-determinism-grading"
sourceIntake:
  - "docs/intake/from-portfolio/2026-06-19-hybrid-determinism-fit-rating.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Ask an LLM to "score this" and **the same input yields different numbers.** `temperature=0` doesn't guarantee otherwise.
- **portfolio** (a grounded-portfolio harness, Apache-2.0, v0.2.0) solves this in `/fit` and `/rating` with a **2-tier hybrid** — *deterministic code* locks the grade and score band first, and the *LLM* produces a fine score only **inside** that band.
- The key insight: **the reproducibility guarantee is the band (deterministically locked), not temperature.** Even when the model wobbles, it *can't exaggerate past its tier.*
- This isn't a portfolio-only trick — it's a **reusable pattern for "LLMs produce inconsistent scores"**, transferable to other evaluation systems.

> **Source note.** Distilled from the portfolio team's intake (command series ④/fit and ⑤/rating). It's all public OSS (`AscendyProject/portfolio`), so the cutoffs, bands, and scores below were verified against current `main` on 2026-06-19. The bigger picture of the tool is in [the portfolio public-launch post](/en/blog/portfolio-public-launch-en/), and the grounding principle it stands on is in [the intro post](/en/blog/portfolio-harness-launch-en/).

## The problem — hand scoring to an LLM and consistency dies

"Grade this candidate's ability 0–100." The LLM gives you a number. But **ask again with the same input and you get a different one.** 82, then 76. For an evaluation system that's fatal — if it doesn't reproduce, it can't be trusted.

"So just set `temperature=0`?" It helps. But it isn't a *guarantee.* temperature=0 makes it *wobble less*; the output can still shift with small changes in model, infra, or prompt. **As long as reproducibility rides on the model's good behavior, it's a hope, not a guarantee.**

And if you hard-code fixed scores instead? Nuance dies. You can't say "this person is a bit higher" or "this one a bit lower" within the same tier. The real problem is getting **consistency and nuance at the same time.**

## The pattern — determinism locks the range, the LLM judges only inside it

The answer `/fit` and `/rating` take is a **2-tier hybrid.**

1. **Deterministic tier — lock the grade and score band.** It never calls the model. Pure code computes a grade (S/A/B/C/D) from the input and pins a fixed **score band `[min, max]`** per grade. Same input → *always* the same grade and band. Locked by tests.
2. **Agent tier — judge only inside the band.** Hand the locked band `[min, max]` and the evidence to the model, get an integer score *within the band* plus reasoning. The score is **clamped** to the band, and any reasoning that cites a ref not in the evidence is dropped by the gate.

So **the model can't change the grade.** Someone who earns an S doesn't drop to A because the model wobbled once. All the model touches is the *fine detail inside the band.*

That's where the key insight lands — **the reproducibility guarantee is the band, not temperature.** temperature=0 is passed best-effort across the seam, but what guarantees "can't exaggerate past the tier" is the *deterministically locked band.* Whatever the model's wobble, it's caged within the band width.

## Instance 1 — `/fit`: match to a JD

`/fit` grades how well my grounded evidence matches a given job description.

```text
Deterministic (fit/score.py):
  coverage% = ratio of (grounded claim tokens ∩ JD keywords)
  coverage% → grade:   S≥90  A≥75  B≥55  C≥35  else D
  grade → score band:  S 96–100 · A 85–95 · B 70–84 · C 55–69 · D 0–54
  (no model call — same portfolio + JD → always same grade/band)

Agent (fit/grade.py):
  locked band [min,max] + evidence → score within the band + reasoning
  score clamped to the band, un-grounded reasoning dropped
```

For honesty: this is a JD-keyword **coverage** rubric, not a "you're N% qualified" verdict. It doesn't model years of experience or domain depth. It *promises less.*

## Instance 2 — `/rating`: a capability grade

`/rating` is the same hybrid, but the **input to the grade is different.** Not a JD — the *evidence metrics themselves.*

```text
Deterministic (rating/profile.py) — each metric cites the evidence ref it's computed from:
  volume (merged PRs):       High 20+ →2pt · Steady 5–19 →1 · Low 0–4 →0
  breadth (distinct files):  Wide 30+ →2 · Moderate 10–29 →1 · Narrow 0–9 →0
  stack diversity (langs):   Polyglot 4+ →2 · Versatile 2–3 →1 · Focused 0–1 →0
  points total → grade (≥ threshold):  ≥6→S  ≥4→A  ≥2→B  ≥1→C  0→D   (same score band)

Agent (rating/grade.py):
  temperature=0 grader, clamped to band
  reasoning bullets whose evidence_refs aren't in the evidence set are dropped
  malformed responses (wrong type / missing / broken JSON) fall back to the band midpoint
```

Exactly the same skeleton as `/fit` — determinism locks the grade, the agent works only within the band. The point is that **the pattern is reusable.**

## What it won't do — `/rating` refuses "top X%"

The thing I most want to say about `/rating` is what it **refuses to do.**

`/rating` does not make population comparisons like "you're in the **top N%** of all developers." To say that you'd need *data comparing you to others*, and there isn't any. **Saying what you don't have is just making it up.** So the grade is strictly about *your own evidence*, not a ranking against others — with no population data to compare against, a percentile *isn't even computed.* The scorecard states in its body that it's "not a position in any population," and the deterministic renderer's own output carries no percentile / rank vocabulary. A regression test (`test_no_percentile_lexicon_in_rendered_output`) keeps the default rendered output free of it. (It doesn't post-scrub the model's reasoning text, though — what makes percentile *impossible* isn't a word filter, it's the structural absence of population data.)

That's the tool's tone — rather than fabricate a basis for an impressive-sounding number, **promise less and keep it exactly.**

## Two defensive details — fail-closed

The hybrid's second tier (the model) is the weak link in trust. So two places are guarded:

- **No citation, no ship.** If a reasoning bullet's `evidence_refs` is empty or absent from the evidence set, the bullet is dropped. (This closed a bug where an empty set vacuously passed the subset check — caught by adversarial code review.)
- **Malformed responses fall back to the band midpoint.** If the model's response is the wrong type or broken, its score isn't trusted — it falls back to the band's midpoint, with no crash and no fabricated refs.

Both cases close toward "don't trust the model when in doubt." Fail-closed, not fail-open.

## Takeaways

- **Don't hand scoring straight to an LLM — lock the range in code and let the model judge only inside it.** You get consistency (the band) and nuance (judgment within the band) at once.
- **The reproducibility guarantee is determinism, not `temperature`.** temperature=0 is best-effort; what guarantees "can't exaggerate past the tier" is the locked band.
- **Wrap the model tier in fail-closed guards.** Drop un-cited reasoning; fall broken responses back to a safe default. Close the weak link by structure.
- **If a claim is only possible by fabricating, cut it from the feature.** A number like "top X%" that can only come from making things up is more honest left undone.

Repo: [github.com/AscendyProject/portfolio](https://github.com/AscendyProject/portfolio) (Apache-2.0, public).

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
