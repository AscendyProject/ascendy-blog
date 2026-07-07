---
title: "I ran every stage on the top model, then moved implementation to a cheap one — here's why I won't go back"
description: "Everyone mixes models, but which one goes on plan, implement, and review differs. I started with the top model everywhere, hit token limits, and cheaped out on implementation. Constraints, not taste, decide the layout."
pubDate: 2026-07-07
author: "Ascendy Engineering"
tags: ["ai", "agents", "llm", "cost", "workflow", "opinion"]
category: "meta"
lang: "en"
translationKey: "where-to-put-the-best-model"
sourceIntake:
  - "docs/intake/from-user/2026-07-07-where-to-put-the-best-model.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Talking with people on my team, *everyone agrees "mixing models gives better results"* — but **which model they put on plan, implement, and review differed completely from person to person.**
- Those three layouts are really different bets on *"where do I spend the best model?"* And what decides the bet isn't taste — it's **constraints** (budget, rate limits, how many agents you run in parallel).
- I **started with the top model everywhere, hit a token wall, and moved only implementation to a cheap model.** And I *won't go back* — because even the top model's code gets fixes in review, so **spinning the loop fast** beat implementation quality.
- So don't copy someone else's layout. **Your constraints decide your layout.**

> **About this piece.** A first-person account pulled out in an interview. "The top model on implementation is overkill" is my *bet,* not a verdict (so I flag the strong lines as my view). The model names are **my actual setup, not a benchmark,** and it's mid-2026, so it dates fast. Same vein as [multi-agent isn't always the answer](/en/blog/multi-agent-not-always-the-answer-en/) and [token usage is not productivity](/en/blog/token-usage-not-productivity-en/).

## Everyone mixes models — but the layout differs

I recently had an interesting conversation with people on my team. Everyone runs agents these days, and **nobody ran on a single model.** They all agreed, without dissent, that *"mixing several models gives better results."* But *how* each of them actually mixed was so different that it was fascinating.

Broadly, three camps. If you split agent work into **plan → implement → review:**

1. **Plan and implement on a cheap model, review on a good one.** (e.g., plan + implement on Gemini 3.5 Flash, review on Claude Opus.)
2. **Plan on a good model, implement on a cheap one, review on another good one.** — that's me. I plan on Claude Opus, implement on Gemini 3.5 Flash, and review on [GPT-5.5](https://openai.com/index/introducing-gpt-5-5/).
3. **Plan, implement, and review all on the top model. Review just on a different family.**

All three follow the same "mix models" principle, but *where they pour the best model* is opposite. Camp 1 bet on "review matters most"; camp 3 bet on "top everywhere, just split the review." So why did I (camp 2) put the top model on **planning** and deliberately cheap out on **implementation?**

## The three layouts are bets on "where to spend quality"

Each layout encodes a belief — an answer to *"if a limited budget let you spend the good model in exactly one place, where would you spend it?"*

- Bet on plan — "if the direction is wrong, everything is wrong. Quality goes up top."
- Bet on implement — "in the end, writing good code is what matters."
- Bet on review — "mistakes will happen anyway. Catching them at the end is what matters."

Each has a plausible logic. But the real reason *I* landed on my own layout wasn't *logic.* It was **constraints.** I learned that from my own experience.

## My path: top everywhere → a wall → cheap implementation

Honestly, I started at **camp 3** too. Plan, implement, review — all on the top model. Judging by quality alone, that seemed obvious.

The problem was **speed and cost.** With the top model everywhere, a single task took too long, and token consumption was so high that **a few tasks in, I'd hit the limit.** I currently run agents in parallel across some six areas, so that limit stung every time. Worst of all was **burning through Claude's weekly limit and getting nothing done for a day or two.**

So I asked the AIs — throwing in the other consideration (the constraint): *"I'm always short on tokens. My budget is fixed, so find me the most token-efficient combination that still gives good results."* Gemini, Claude, and GPT **unanimously** said my current camp-2 structure was better.

The funny part: I effectively *put it to a vote among AIs and went with the majority* (had they disagreed, I'd probably have made them debate it). But to be honest — that unanimity wasn't so much *a trustworthy signal because they agreed;* it was closer to **the obvious arithmetic anyone spits out once you impose a budget.** Put the cheapest model where the most tokens burn. That's it. I don't use it because I *believed the vote* — I use it because I **tried it as a fix after hitting the wall and was satisfied.**

And in fact, **implementation is usually the most token-hungry stage** — you pour out long stretches of code, fix them, iterate. When the budget is tight, cheaping out *there* has the biggest saving leverage. Plan is low-token and high-leverage, so a good model; review has to catch failures, so a good model; the cheap model goes on what's left — implementation. That's what my camp 2 really is.

Even **which model I use for implementation is decided by budget, not quality.** On personal projects I implement with Claude Sonnet; at work, with [Gemini 3.5 Flash](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/) (which Google positions as a faster, cheaper model for agents and coding). Not because one is better — just *which budget I'm running on.*

## Why I won't go back — the top model gets caught in review anyway

Here's the key question. *"If tokens became unlimited tomorrow, would you go back to camp 3 (top everywhere)?"*

My answer is **no.** Here's why.

**Even when Claude Opus 4.8 writes the code, review by Codex always turns up something to fix.** This held true even when a top-tier model like Fable 5 wrote it. *A perfect one-shot result is impossible anyway.* If that's true, then the contest isn't about implementation-model quality — it's about **producing a result fast → getting feedback fast → spinning that cycle fast.** That's the call I made.

So the implementation stage comes down to this:

- **It only has to clear "good enough to implement the plan properly."** Quality above that gets swept up by review anyway — it's *overkill.*
- But **there is a floor.** Pure speed would say Haiku, but Haiku couldn't even *implement the plan itself* well. It doesn't clear the floor. Sonnet and Gemini 3.5 Flash do.

So the cost constraint didn't force a *compromise* on me. It taught me that **using the top model on implementation was waste.** Inside a fast-spinning loop, the gain from a slightly smarter implementer was smaller than the gain from *completing one more lap.*

## So — don't copy someone else's layout

The conclusion of this story isn't "camp 2 is best." If anything, the opposite.

I can't claim to know *why* the colleagues chose camps 1 and 3. But what my own experience clearly shows is that **a layout is driven far more by constraints than by opinion.** If you run fewer agents in parallel and never hit the limit, or have a generous budget, or your tasks are ambiguous enough that implementation needs a lot of judgment too — the optimal layout shifts. So if someone's layout differs from yours, ask whether the *constraints* differ before concluding the *opinion* does.

So when someone says "this combination is the answer," you should ask back: *"under which constraints?"* What to put on plan, implement, and review isn't decided by a benchmark table. It's decided by **your budget, your rate limits, your parallelism, the shape of your work.** Even I won't go back to camp 3 if tokens go unlimited — and your situation differs from mine anyway.

## Coda: what the paralyzed two days gave me

One more thing. Those one or two days of getting nothing done because I burned through Claude's weekly limit — they weren't purely frustrating.

If anything, that's when I **stop and think for a bit.** Things I miss while heads-down grinding out implementation tend to surface when my hands are tied. *Where was I even heading, is this the right direction.* A forced pause becomes an unexpected review.

The token limit is undeniably a constraint. But that constraint made my layout better, and sometimes it stopped me and made me look at the direction again. Constraints weren't always the enemy.

## Takeaways

- **Everyone mixes models, but the layout differs.** That difference is made by constraints (budget, rate limits, parallelism, task shape) — not taste.
- **I went from top-everywhere to cheap-implementation, and I won't go back.** The top model gets caught in review too, so if a perfect one-shot is impossible, *spinning the loop fast* wins.
- **Implementation only needs to clear "good enough to implement the plan."** Above that, review sweeps it up — overkill. But a model that can't clear the floor (like Haiku) won't do.
- **Don't copy someone else's layout.** Ask "under which constraints?" first. Your constraints decide your layout.

Honestly this piece is my *bet,* not a verdict. But before agonizing over "where to spend the best model," **asking "what constraints am I under right now" first** — that's the most practical ordering I learned by hitting a wall.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
