---
title: "The model I trusted most led me into a dead end"
description: "Four stages of migrating a photo-preprocessing pipeline. The model I trusted most recommended a dead end; the answer was in none of the models but in moving between them. Automating that cross-check became redteam."
pubDate: 2026-06-24
author: "Ascendy Engineering"
tags: ["multi-model", "redteam", "ai-infra", "cross-review", "build-in-public"]
category: "meta"
lang: "en"
translationKey: "trusted-model-dead-end"
sourceIntake:
  - "docs/intake/from-user/2026-06-24-trusted-model-dead-end.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Ascendy's photo-preprocessing infra actually went through four stages: **external multimodal API → self-hosted cluster GPUs → managed GPU → serverless.** (The infra-technical details are already in the [AI serving evolution series](/en/blog/ai-serving-evolution-part1-en/) — this piece is about the *model side* of those decisions: *which model recommended what, and why it hit a wall.*)
- The heart of it: **the model I trusted most (Claude) recommended a structure that was a dead end.** And it kept circling *inside the structure it had recommended,* never showing me what lay outside it.
- What broke the deadlock was a model from a *different family.* And the decisive implementation right after was Claude again. **No single model handed me the answer in one shot.**
- The answer was in none of the models. It was in **moving between them.** Getting tired of doing that by hand is what I automated into [redteam](https://github.com/AscendyProject/redteam).

> **About this piece.** The four stages here are the path Ascendy's AI preprocessing infra *actually* took. That's why it doesn't wobble — it all really happened. The *outcome* view of the same journey is already written up in the [AI serving evolution series](/en/blog/ai-serving-evolution-part1-en/). This piece is about *how I got to* those decisions.

## 1. The easiest answer broke at scale

I started photo preprocessing with direct calls to an external multimodal API. A few hundred images was fine. But a cloud has to handle thousands, tens of thousands — and at that scale the cost structure blew up and the service simply didn't hold together.

Ask one model "how do I process this?" and the easiest, most plausible answer comes first. That answer was perfect at a few hundred images. It just broke at scale.

## 2. Where trust became a dead end

When I said I wanted to process on GPUs directly, Claude recommended standing up GPU nodes on our own cluster. I trusted Claude most, and I went with it.

The result was inefficient sliced GPUs, high cost, and endless OOMs. Running pricey GPU nodes 24/7 with no users yet was overkill. Above all — Claude kept circling *inside the very structure it had recommended.* It told me how to reduce the OOMs, how to slice the GPUs better, but it couldn't show me the outside: "maybe this structure is wrong to begin with."

This is the heart of the piece. **The more you trust a model, the more its field of view becomes the limit of yours.** Not because the model is wrong. It does its best inside the premises it set, and so it can't question those premises. People are the same.

## 3. A different model family filled the blind spot

Stuck, I carried the same problem, unchanged, to GPT and Gemini.

They proposed a *managed GPU service* — an axis that simply wasn't in the field of view of the model I'd been asking. Instead of self-hosted always-on GPU nodes, moving the processing there ran through thousands of images, and the OOMs disappeared.

The point isn't that the service was The Answer. It's that **the axis that got me out of the dead end lay outside the first model's field of view.** A model from a different family filled that gap.

## 4. Direction and implementation came from different models

Then the idle cost bothered me — money went out even when nothing ran. I asked everyone again. Gemini gave the direction: go serverless. The one who actually *implemented* that idea was — Claude again. Operating cost dropped sharply.

Let me be clear. **This is not a piece tearing Claude down.** Claude did the final implementation best. Even the dead end in stage 2 isn't "Claude was wrong" — it's an instance of a structural fact: *no single model sees outside its own field of view.* I didn't drop Claude. I *cross-checked* it against other models.

## The answer was between the models

After four stages, one conclusion remains.

> The answer was in none of the models. It was in moving between them.

The model that gave the plan, the one that led me into the dead end, the one that got me out, and the one that did the final build were all different. Had I handed everything to any one of them, I'd still be fighting OOMs.

But doing this "moving between models" by hand, every time, is exhausting. Copy the same problem to three models, compare the answers, work out which one is trapped inside its own premises. Because it kept giving the same kind of value every time, I eventually automated it. That's [**redteam**](https://github.com/AscendyProject/redteam) — a multi-model cross-review harness that forces a model from a *different family* to review the code independently.

The tool didn't come first with a story bolted on. **The story came first, and it produced the tool.** redteam's principles are just this episode moved into code review: the model that wrote the code shouldn't judge its own safety, and the reviewer must be a different family to break the rubber-stamp.

The same idea seen through autonomous loops is in [the heart of loop engineering is verification](/en/blog/loop-engineering-verifier-en/).

---

Repo: [github.com/AscendyProject/redteam](https://github.com/AscendyProject/redteam) (Apache-2.0).

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
