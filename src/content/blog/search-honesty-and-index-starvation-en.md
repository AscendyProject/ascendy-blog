---
title: "Making search honest revealed the real bug — it was probing 1% of the clusters"
description: "An agent returned the wrong photos and said 'Found 30.' The first fix wasn't search quality but making search admit when it found nothing — and that honesty flag became a probe that exposed two deeper causes."
pubDate: 2026-08-12
author: "Ascendy Engineering"
tags: ["vector-search", "rag", "ann", "retrieval", "observability", "postmortem", "llm-agents"]
category: "ml"
lang: "en"
translationKey: "search-honesty-and-index-starvation"
sourceIntake:
  - "docs/intake/from-backend/2026-08-09-search-honesty-and-index-starvation.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We asked the photo platform's AI agent for photos in a specific category. It returned **30 photos from an entirely different category and confidently said "Found 30 photos."**
- The first diagnosis wasn't search quality — it was **honesty.** Top-k nearest-neighbor search fills k results regardless of relevance as long as candidates exist; it **cannot say "none."** When every filter fired and the candidate set hit zero, a fallback returned a raw nearest-N with no threshold — and because the return type was a plain list, **the caller couldn't tell a fallback from a properly ranked result.**
- So the fix wasn't to the search; it was to the **return shape.** One fallback flag, propagated through the whole pipeline. **The result IDs are byte-for-byte identical. Only the way it speaks changed.**
- Then that flag turned into an **observability probe.** With it on, nearly *every* search was falling through to fallback. The threshold sat almost twice as high as this embedding model's actual match band — and even after recalibrating it, the candidate count was still single digits.
- The real culprit sat a layer deeper: **the ANN index parameters.** The index had been built with many clusters but configured to probe only a tiny fraction of them — **sweeping barely 1% of all clusters.** At this scale the team judged that probing every cluster costs little enough, and probing all of them at least removes the loss that comes from *never looking at a list.* *The time the approximation could save was small to begin with, while the recall it cost was not.*

> **Source note.** Written from two backend-team intakes (fallback honesty / ANN parameter starvation) merged into one piece — they are the front and back of a single incident. Internal code identifiers, infrastructure and serving configuration, and absolute figures that would pin down scale are generalized; personal photo content is not described. The prior decision in this same search stack is in [we dropped the reranker](/en/blog/dropping-the-reranker-en/).

## "Found 30 photos" — none of them were that category

The symptom was simple. We asked the photo platform's AI agent: *"Of the photos taken this year, can you find just the ones about a particular subject?"* The agent returned 30 photos and answered — **"Found 30 photos."**

Not one of them was that subject. They were photos that make up a large share of the library and had nothing to do with the request.

What matters here isn't *that* it was wrong but **how** it was wrong. Not an error. Not an empty screen. The system was **confidently** wrong.

## Top-k cannot say "none"

The first layer of cause lives in the structure of vector search itself.

Top-k nearest-neighbor search **fills k results regardless of relevance, as long as there are candidates to fill them with.** It returns fewer only when the searchable population is smaller than k — never because relevance was too low. If the library holds nothing on that subject, then the "least far" thing from that query becomes **whatever dominates the library.** The distance is large but the rank is still first. For top-k, the output "nothing suitable here" simply does not exist.

There were, of course, two lines of defense against this:

1. A similarity elbow cutoff plus an absolute threshold
2. A caption-text-based re-ranking pass with its own threshold

*(The second is a text-matching stage. It is not the [cross-encoder reranker we removed earlier](/en/blog/dropping-the-reranker-en/) — different thing, don't conflate them.)*

The problem was the path taken when **both defenses worked correctly and the candidate set became empty.** There sat a fallback with the rationale *"better something than nothing."* It returned a raw nearest top-N with no threshold and no re-ranking.

That choice is debatable on its own, but the fatal part came next. **The return type was just a list.** A properly ranked result was a list; an unthresholded fallback was also a list. The caller had **no way to know** which one it had received.

And the final consumer of this pipeline was an LLM agent. The tool said "Found 30 photos," so the agent passed that straight to the user as **"Found 30 photos."**

**An LLM amplifies the tone of its tool output.** If the tool sounds certain, the answer sounds certain. If the tool doesn't communicate its own uncertainty, the LLM will not supply the doubt on its behalf.

## The fix was the return shape, not the search quality

The fix wasn't to make search smarter. It was to make it **honest.**

The return shape became `{results, fallback}`, with the flag set only on the fallback path and propagated through the whole pipeline — hybrid search → agent tool → LLM summary. The agent now says: *"There are no matching photos; here are the N most similar instead."*

The key detail: **the result IDs are byte-for-byte identical.** The same 30 photos come back. The only thing that changed is *how it speaks.*

That's the essential property of this fix. **Honesty is an axis separate from search quality, and it's usually far cheaper to fix.** User trust survives a result that knows how to say "none" far better than it survives a wrong result.

Generalized: **when you build a fallback, propagate that fact to the caller.** The path where every defense fires and the result count reaches zero *will* exist. If you don't design the UX of that path, the code decides it arbitrarily.

## That flag became an observability probe

That was the whole intended fix. But after deploying it, something unexpected showed up.

**Nearly every search was falling through to fallback.**

The honesty flag had been built as a UX device, and once it was in place it was also an **observability probe.** What used to be a vague sense of "sometimes the results look off" became a **countable signal**: this query was a fallback.

That's structural, not accidental. Silent failures swallow signal — the same structure this blog keeps running into with [log levels](/en/blog/celery-silent-info-logs-en/) and [dual writes](/en/blog/silent-primary-write-dual-write-en/). **The moment you name the path that was quietly emitting wrong answers, that path's frequency becomes measurable.**

One line of observability logging, and looking at the real distribution exposed the second layer. **The absolute similarity threshold sat almost twice as high as this embedding model's actual match band.** With the cut far above the range where genuinely correct results cluster, even normal matches were being sliced away, and every search dropped into fallback.

**Cosine similarity scales differ by model.** A threshold copied from somewhere else means nothing *with respect to this model's distribution.*

## But why are there so few candidates?

Even after recalibrating the threshold, something remained off. **The candidate count itself was in the single digits.**

We suspected index coverage — maybe many photos never got embedded? A recount showed the vectors were essentially all there. The data existed. Search just wasn't seeing it.

The culprit was the **IVF index parameters.** IVF-family ANN indexes partition vectors into clusters (`nlist`) and, at query time, probe only some of them (`nprobe`). A standard trade — give up a little accuracy for speed.

But this index had been built with **many clusters while probing only a sliver of them.** As a ratio: about **1% of all clusters.** The vectors sitting in the rest may as well not have existed on any given query. (List lengths are uneven, so this does not mean "99% of the vectors" — that is a separate number you have to measure.)

Where that setting came from was obvious. It was **a recipe for millions of vectors, copied onto a far smaller collection.** At that scale the values are reasonable. At this one, **the team judged that probing every cluster costs little enough.** And probing every cluster **removes the loss that comes from never looking at a list.** (If the index stores compressed vectors, quantization loss remains, separately — what disappears here is the list-selection axis.)

Which means the time the approximation could save was small to begin with, while the recall it cost was not.

## Expected-value math reorders your hypotheses

"the probe fraction looks low" is still a suspicion. What moved it to the front of the queue was **one line of arithmetic.**

If you know the fraction of clusters probed and roughly how large the candidate pool is, you get a rough count of the vectors the search will actually touch.

```text
expected candidates ≈ pool size × (clusters probed / total clusters)
```

That estimate **landed in the same order of magnitude as the observed candidate count.**

But it's worth stepping back here. **This is a consistency check, not a proof.** The formula assumes vectors are spread evenly across clusters, whereas IVF list lengths are in fact uneven, and `nprobe` doesn't take a random sample — it picks the centroids *nearest the query.* All the order-of-magnitude agreement tells you is "this is not inconsistent with the index-parameter hypothesis," not "this is the cause."

It still earned its keep, though, because **it reordered the hypotheses.** Coverage had already been erased by measurement; the parameter hypothesis was consistent with what we saw. So the next move was exhaustive probing — sweep every cluster and *list selection drops out as a variable,* so if candidates still don't recover, the hypothesis is immediately shown to be wrong.

This is a tool worth reaching for constantly. **When you have an observation and a hypothesis, compute the number your hypothesis predicts and check it against the observation.** If it doesn't match, either the hypothesis is wrong or there's another layer. If it does — you don't have a diagnosis; you have *a reason to test that hypothesis first.* Blur that distinction and a consistency check gets promoted to a proof.

There was one embarrassing side trip too. An **aggregate query run during diagnosis omitted the owner filter**, and we nearly read a total across all users as one user's figure. That very nearly burned a whole round. **The measurement queries you use while diagnosing are also subject to review** — if they're wrong, every inference built on them is wrong.

## The order of diagnosis cut the number of deploys

Looking back, the most practical lesson from this incident was sequencing.

1. **Add observability logging** — 1 deploy
2. **Measure coverage** — a read-only script an operator runs, 0 deploys
3. **Fix the parameters** — 1 deploy

Each step **noticeably narrowed what the next one had to check.** Step 2 in particular erased an entire hypothesis with no deploy at all ("it isn't missing data"). In production debugging, deploys are expensive and slow. Eliminate the hypotheses you can eliminate without one, and the remaining deploy budget goes to the actual fix.

Finally, a small convention. **Next to a threshold constant, leave a comment recording the measured distribution that justified it.** A constant with no stated basis is one the next person can't touch, and one that silently becomes wrong the moment you change models.

## Takeaways

- **Top-k cannot say "none."** It fills k while candidates exist and never rejects on relevance, so when nothing matches, whatever dominates the dataset comes first. Thresholds are not optional.
- **Honesty is an axis separate from search quality, and usually cheaper.** Returning the same results while saying "no matches; here's what's similar" is enough to protect trust.
- **If you build a fallback, propagate the fact to the caller** — especially when the final consumer is an LLM, which amplifies the tone of its tool output.
- **An honesty flag is an observability probe in its own right.** Naming a silent failure path makes its frequency measurable, and that measurement is what pulled out the real causes.
- **Validate ANN parameters against your data's scale.** Copy a large-scale recipe onto a small collection and the time the approximation saves is small while the recall it costs is not.
- **Expected-value math reorders hypotheses — it does not prove one.** Write down the assumptions the formula rests on (even distribution, and so on) so a consistency check doesn't get promoted to a proof. And the measurement queries used while diagnosing are themselves subject to review.

After peeling all three layers, the impression that stayed was this: what we fixed first wasn't a bug, it was **a posture.** And without that change of posture, the two layers beneath it would still be nothing more than a vague sense that search is sometimes off.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
