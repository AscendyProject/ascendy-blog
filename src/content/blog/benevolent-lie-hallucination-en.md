---
title: "The benevolent lie — how much hallucination do you allow in an AI-written post?"
description: "An AI draft slipped in a detail not in the source — '3am, the third OOM.' It reads well, but I don't know if it's true. When human memory is itself a kind of hallucination, where's the line between color and fact?"
pubDate: 2026-06-01
author: "Ascendy Engineering"
tags: ["ai-writing", "hallucination", "fact-checking", "vibe-coding", "memory", "editorial"]
category: "meta"
lang: "en"
translationKey: "benevolent-lie-hallucination"
draft: false
redactionReviewed: true
---

## TL;DR

- An AI-written post slipped in a detail **that wasn't in the source** ("3am, the third OOM hit"). It reads better — but I, the author, **don't know if it's true**.
- Human memory is itself a kind of hallucination — imprecise, distorted over time. **Vibe-coding** makes it worse: I made the code, but I didn't type it, so I can't remember code my fingers never touched.
- So the line isn't "harm" but **"falsifiability."** If a record (git, docs, infra logs) can refute it, hold the line; if not, label it "from memory." And the simplest defense — **ask before you write**.

> **Source note.** The primary source for this post is an operator interview (this post was written that way). The "3am" anecdote is color the AI draft introduced; the body is transparent about its provenance.

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

## The line is drawn at "falsifiability," not "harm"

Here the line gets clear. My first criterion was "if it harms no one, it's fine." But the real criterion is **"can it be refuted?"**

Nothing refutes the 3am — so it's gray, and so it's allowed as color. But a commit timestamp in git, the actual figure on a bill, the cause of an outage — a record can declare those **"wrong."** Inventing them is qualitatively different from the 3am. What separates color from fact isn't "harmlessness" — it's **whether someone (or something) can refute it.**

## So, ask before you write

The way to cut hallucination falls out of the same place. Even if I don't remember an issue precisely, **as long as I remember that it was recorded somewhere**, I can ask the AI — *"this should be in git or docs, so fact-check it against that."* If there's a record, fact-check; if there's no record at all, label it honestly as "from memory."

This post has a twist of its own. The piece you're reading was written by **an AI interviewing me — grilling me.** *"Was it really 3am?"* — that one question split color from fact. The simplest way to stop an invented detail wasn't a smooth filter at the end; it was **asking, before the writing.**

## Decisions / tradeoffs

- **Allow color, but be transparent about provenance.** Unfalsifiable color (time, mood) can be allowed for readability — as long as the post doesn't hide that it's color (like this post's source note).
- **Don't invent what's falsifiable.** Facts that git, a bill, or a log can declare wrong are not in the territory of color.
- **Label the unrecorded.** A single line saying "from memory" stops the drift into plausible fiction.

## What's next

- Turn the interview method into a reusable writing harness — make "ask before you write" a tool.
- Formalize per-layer trust (git → docs → infra logs → memory) into the source-note convention.

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
