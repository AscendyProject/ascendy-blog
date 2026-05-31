---
title: "The benevolent lie — how much hallucination do you allow in an AI-written post?"
description: "An AI draft slipped in a detail not in the source — '3am, the third OOM.' It reads well, but I don't know if it's true. When human memory is itself a kind of hallucination, where's the line between color and fact?"
pubDate: 2026-06-01
author: "Ascendy Engineering"
tags: ["ai-writing", "hallucination", "fact-checking", "vibe-coding", "memory", "editorial"]
category: "meta"
lang: "en"
translationKey: "benevolent-lie-hallucination"
sourceIntake:
  - "docs/intake/from-user/2026-06-01-benevolent-lie-interview.md"
draft: false
redactionReviewed: true
---

## TL;DR

- An AI-written post slipped in a detail **that wasn't in the source** ("3am, the third OOM hit"). It reads better — but I, the author, **don't know if it's true**.
- Human memory is itself a kind of hallucination — imprecise, distorted over time. **Vibe-coding** makes it worse: I made the code, but I didn't type it, so I can't remember code my fingers never touched.
- So the line has two layers: don't invent what a record (git, logs) can refute, and for the unrecorded, label it "from memory" *if it's actually in my memory* — but **discard it if the AI made it up**, label or not. Color isn't deleted; it's **replaced by pulling the real thing out via interview**, and "looks fake" is answered with **provenance**.

> **Source note.** The primary source for this post is an operator interview, and **this post itself was written as an early trial of the harness we're building — "an AI interviewing the operator to draw out a piece."** The quoted sentence "3am, the third OOM hit" was **invented wholesale by the AI draft** (neither the time nor the "third" count exists in any source) — it's an example this post *rejects*. Transparent labeling does not turn it into a permitted fact.

## Two thoughts at once

An AI writes my blog posts. One day a draft slipped in a sentence that wasn't in the source — *"3am, the third OOM hit."*

Two thoughts arrived at once. One: **"That's it — a post needs this to be readable."** Two: **"But if someone asks me whether this is true, I don't know."**

## A benevolent lie?

I approved that 3am anyway. Color like a timestamp harms no one if it's off. And besides — over the last five months there were far too many nights I worked past 3am. It was "plausible enough." Less a lie than **a fact I can't remember**.

But a strange question followed. **Can I call something "wrong" if I can't even remember it?**

## Human memory is itself a kind of hallucination

People don't remember every event. We remember the memorable ones, the important moments — and even the level of detail varies from person to person. And being important doesn't guarantee you'll remember it.

My own wedding was like that. I was so nervous and overwhelmed that I barely remember who came or whom I greeted. If someone who *wasn't* there said, "I was there, remember?" — I'd probably just go, "huh, I guess."

Human memory is, in itself, a kind of hallucination. Imprecise, and more distorted as time passes. Set out to ask "how much of an AI's hallucination do I allow," and you arrive at the realization that your own memory — the supposed yardstick — isn't all that trustworthy either.

## Vibe-coding pushes this one step further

AI coding cuts one more of memory's anchors. With vibe-coding, **I made the code, but I'm not the one who typed it.** Remembering code my fingers never touched is nearly impossible. The sense of "code I wrote" is there, yet not one of its lines is left in my hands.

That's why records matter. Blog, docs, git. The trouble is when a project moves fast — that's when you skip the records, and that's when memory later warps and hallucination slips in.

Records come in layers. Git commits and docs are the most direct; failing those, **cloud-infra logs or console history** prop the memory up. One stage of that earlier "OOM war story" didn't survive cleanly in git, but a trace in the infra logs promoted it to "a near-certain memory."

## Where's the line — falsifiability, and why that alone isn't enough

My first criterion was "if it harms no one, it's fine." So I figured harmless color like the 3am was allowed. But that was wrong.

The first criterion is **"can it be refuted?"** A commit timestamp in git, the actual figure on a bill, the cause of an outage — things a record can declare **"wrong"** — must not be invented. The 3am passes this test; nothing refutes it.

But **being unfalsifiable doesn't mean it's allowed.** Nothing refutes the 3am, yet *it's nowhere in my memory either* — the AI made it up because it was plausible. My nodding "sure, that's plausible" after the fact came not from memory but from endorsing plausibility. That's not color; it's fabrication.

So the line has two layers:

1. **Don't invent what a record can refute** (commit time, bill, outage cause).
2. **For the unrecorded: if it's in my memory, label it "from memory" and keep it — but if the AI made it up, discard it, label or not.**

The 3am fails layer 2 — unfalsifiable, but AI-invented rather than mine.

## Doesn't this go bland? — color isn't deleted, it's replaced

The obvious worry follows. **If you filter color out like that, doesn't the writing go bland?** So bland that it reads as "an AI wrote this" — or even *fake* — despite being my own story.

The answer is that color isn't *deleted*; it's **replaced by pulling the real thing out via interview.** Drop the AI's invented "3am," but put my real memory in its place — barely remembering who came to my wedding, the months of nights worked late, the code I wrote but never typed. None of it invented; all of it drawn out by the interview — so it's *vivid and honest at once.*

And the "looks fake" worry is answered by **showing the source.** In the AI era, trust comes not from "vivid = a human wrote it" but from **a verifiable source.** This post's source note is the proof that "a person who actually lived it wrote it, with provenance." A vivid post with a visible source beats a vivid post with none.

## So, ask before you write

The way to cut hallucination falls out of the same place. Even if I don't remember an issue precisely, **as long as I remember that it was recorded somewhere**, I can ask the AI — *"this should be in git or docs, so fact-check it against that."* If there's a record, fact-check; if there's no record at all, label it honestly as "from memory."

This post has a twist of its own. The piece you're reading was written by **an AI interviewing me — grilling me** — as the first trial of the very harness we're building. *"Was it really 3am?"* — that one question split color from fact. The simplest way to stop an invented detail wasn't a smooth filter at the end; it was **asking, before the writing.**

## Decisions / tradeoffs

- **Don't invent — draw the real thing out via interview.** Color isn't deleted, it's replaced: drop the AI's invented detail, pull a real one from the operator's memory. That's the only way to get vivid *and* honest.
- **Don't invent what's falsifiable.** Facts that git, a bill, or a log can declare wrong are not in the territory of color.
- **Label what's from memory; discard what's AI-invented.** If my memory is the source, say "from memory" and keep it — but don't paper over pure AI invention with a label.
- **Provenance is the currency of trust.** Answer "looks fake" with a transparent source (the source note), not with vividness.

## What's next

- Turn the interview method into a reusable writing harness — make "ask before you write" a tool.
- Formalize per-layer trust (git → docs → infra logs → memory) into the source-note convention.

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
