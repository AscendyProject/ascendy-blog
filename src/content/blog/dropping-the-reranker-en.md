---
title: "We dropped the reranker from vector search — what 'find all the baby photos' broke"
description: "We dropped the reranker from photo search. 'Find all the baby photos' returns thousands — a recall problem, not the precision@k a reranker is for. So we used MRL embeddings: low-dim filter, then high-dim refine."
pubDate: 2026-06-09
author: "Ascendy Engineering"
tags: ["vector-search", "embeddings", "reranker", "matryoshka", "retrieval", "rag"]
category: "ml"
lang: "en"
translationKey: "dropping-the-reranker"
sourceIntake:
  - "docs/intake/from-user/2026-06-09-dropping-the-reranker.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Reworking our photo-search stack, we did two things: swapped the embedding from **bge-m3 + bge-reranker → Qwen3-VL-Embedding**, and **dropped the reranker entirely.** The two decisions have different reasons.
- What killed the reranker: **"find all the baby photos"** — a query that must return thousands. That's a *recall* problem, not *precision*, and a reranker is (a) too slow/expensive to cross-encoder-score thousands of candidates, and (c) it imposes a top-k cutoff that truncates "all of them." **A reranker is a precision@k tool, not a bulk tool.**
- We rejected "turn the reranker off only for bulk queries" — one sentence can mix include/exclude conditions, and the *intent* of "show me all" ("literally all" vs "just a lot") can't be inferred. **You can't route this from natural language reliably.**
- Instead, **Qwen3-VL-Embedding's MRL** (Matryoshka) let us do a **low-dim first-pass filter → high-dim refine**, recovering precision without a separate reranker.

> **Source note.** Written from an operator interview. Model specs were fact-checked at publish time against official sources ([HF Qwen3-VL-Embedding](https://huggingface.co/Qwen/Qwen3-VL-Embedding-8B), [the unified-framework arXiv paper](https://arxiv.org/pdf/2601.04720)); internal collection/infra identifiers and exact dimension tuning are generalized (model names are public). The product motivation connects to [photos: the problem was never storage, it was *finding*](/en/blog/why-we-built-ascendy-en/).

## Two decisions, different reasons

Reworking the search stack, we made two decisions — and they're separate. They're easy to conflate, so let's split them first.

- **Embedding swap** (bge-m3 + bge-reranker → Qwen3-VL-Embedding): photo search has to capture *semantic, multimodal context*, not lexical match. Qwen3-VL-Embedding is a multimodal embedding over text, images, and video — a fit for photos.
- **Dropping the reranker**: this wasn't a model-quality issue. It was about the **nature of the query.** That's the story below.

## The assumption "find all the baby photos" broke

I realized the reranker had to go while testing. One scenario broke the assumption.

**"Find all the photos with a baby in them."**

A query like that has to return thousands. And here's the key distinction — that's a **recall** problem, not a **precision** one. Success isn't "how accurate are the top 10," it's "did we pull back everything there is."

A reranker is structurally wrong for that bulk.

- **(a) Cost/latency blow-up.** Cross-encoder-scoring thousands of candidates one by one is too slow and too expensive. A reranker runs the model once per query-document pair, so cost grows linearly as candidates grow.
- **(c) Cutoff truncation.** A typical reranker pipeline *reorders a limited candidate set (top-k)*. Against "give me everything there is," that top-k cutoff slices off correct answers.

In one line: **a reranker is a precision@(small k) tool, not a "find all of it" recall tool.** We'd been using it for the wrong job.

## "So just branch by query type?" — you can't

The most natural objection lands here. *"Turn the reranker off for bulk queries ('find all'), and on for pinpoint queries ('the photo of my son blowing out the candles')."* Branch by query type. We considered it — and **rejected it.** Two reasons.

**One: natural language doesn't cleanly separate conditions.** A single sentence can mix an *include* and an *exclude* — "skip the ones with a dog, but show me all the baby photos." Having an LLM perfectly decompose that and route "this part is bulk, this part is pinpoint" is close to impossible. Get it wrong once and the user gets the wrong result.

**Two: even if you could split it, you can't infer intent.** "Show me all" is *literally all thousands* for one person and *just show me a lot* for another. If the system guesses the intent behind the same phrase, half your users get something other than what they expected every time. **You can't reliably read, from natural language alone, an intent that diverges under identical wording — not safely, not consistently.**

So instead of branching, we removed the reranker outright. What backed the decision: precision held up on the embedding alone — search quality was fine from the moment we pulled it.

## The replacement — a two-stage built on MRL (precision without a reranker)

We thought about how to shore up precision after dropping the reranker, and it was easier than expected. **Qwen3-VL-Embedding has MRL (Matryoshka Representation Learning).** A single embedding vector keeps its meaning even when truncated short — like a matryoshka doll, the leading slice of dimensions is itself a usable embedding. Per the official spec, the embedding dimension goes **up to 4096** (2B is 2048, 8B is 4096), with user-defined output dimensions anywhere from **64 to 4096**.

We built a two-stage out of that.

1. **Low-dim first-pass filter** — sweep the whole set *fast and cheap* at a low dimension to narrow candidates. Low dimensions make the comparison light.
2. **High-dim refine** — re-compare only the narrowed candidates at a *higher dimension* to sharpen the ranking.

Without a separate cross-encoder reranker model, we get a reranker-*like* effect **inside a single embedding model.** The logic differs, though — this is two-stage dense retrieval at different dimensions, not a cross-encoder re-scoring query-document pairs. Coarse-to-fine lifts precision while *not* blocking bulk (the low-dim first pass).

The result: **precision held, bulk works, and the stack got simpler by one model.**

## Takeaways

- **A reranker is a precision@k tool, not a recall/bulk tool.** If you have "find all of X" queries, the reranker's top-k and cross-encoder assumptions break right there. Match the tool to the *nature* of the query.
- **Don't route bulk-vs-pinpoint from natural language.** One sentence mixes conditions, and the intent behind identical wording diverges across people — you can't split it safely on language alone.
- **MRL coarse-to-fine can be a lightweight reranker alternative.** A low-dim first pass keeps bulk alive; a high-dim second pass recovers precision — one model, no separate reranker.
- **Validate dropping a model by whether quality holds without it** — for us, precision holding on the embedding alone is what backed the call.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
