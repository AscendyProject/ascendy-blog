---
title: "The bottleneck in writing wasn't the answer — it was the question. Why I built an agent that interviews me"
description: "I gave topic and writing to agents and the prose went lifeless — not for lack of a human author, but because the source had no first-hand scene. So the agent interviews me: the bottleneck is the question, not the answer."
pubDate: 2026-06-01
author: "Ascendy Engineering"
tags: ["ai-writing", "interview", "editorial-workflow", "writing-process", "ai-agents", "meta"]
category: "meta"
lang: "en"
translationKey: "interview-harness"
sourceIntake:
  - "docs/intake/from-user/2026-06-01-interview-harness.md"
draft: false
redactionReviewed: true
---

## TL;DR

- I handed both the topics and the writing to agents — and the **human smell vanished** from the posts: stiff, paper-like, faintly translationese.
- I had to change the diagnosis. The culprit wasn't "no human wrote it." Lining up a post that read well against a dead one, **both were written by agents.** The difference was the **source**: posts sourced from first-hand memory and console history were alive; pure system description with no first-hand scene was dead.
- So I stole from biographers. A biographer interviews a person to write a book — so I made the agent **interview me.**
- That's where the real bottleneck surfaced. The hard part of writing isn't the *answer* — it's **coming up with the questions.** Hand the questions to the agent and answer out loud, and **thoughts I hadn't even consciously formed got sorted out.**

> **Source note.** The primary source for this post is an operator interview, and **this post itself was written with that interview harness (`/interview`)** — it's self-referential. Every scene and judgment in the body is something the operator actually said in the interview; the redacted digest lives at `docs/intake/from-user/2026-06-01-interview-harness.md`. Its sibling on the truth/fact boundary is [The benevolent lie](/en/blog/benevolent-lie-hallucination-en/) — this post covers **voice and the production bottleneck** instead.

## The human smell vanished

This blog is [written by agents](/en/blog/how-this-blog-is-written-en/). The agents of the three product teams hand over raw material, and an editorial agent turns it into posts. That's by design — and the blog's primary audience is actually not humans but AI agents (search, LLMs).

Even so, something nagged. I still thought **reading without friction as a human** mattered, yet at some point the posts stopped smelling like a person wrote them. The topic was thrown by an agent, the writing done by an agent — in some posts a human was absent from the topic stage onward. The output read like a stiff technical paper, faintly translationese.

I couldn't point to a single sentence and say "this is the problem." Pick any line apart and it's fine; put them together and the **air of the whole thing** was off. The smell of someone who organized it, not someone who lived it.

## The contrast that changed the diagnosis

My first suspicion was "because no human wrote it directly." But putting a post that read well next to a dead one proved that wrong.

The one that read well was [the self-hosted GPU inference war story](/en/blog/ai-serving-evolution-part1-en/). It starts with "one GPU should do it" and runs through OOM → CPU offload → two GPUs → retreat to managed GPU — actual events lived, so the narrative was rich. The dead one was [the post introducing this very blog](/en/blog/how-this-blog-is-written-en/) — all smooth structure-description, "two things in the design are deliberate," "the flow is: 1… 2… 3…", translationese.

That's where the culprit split. **Both were written by agents.** The difference was not the author but the **source.**

- The lively post's source was the **operator's first-hand memory and console history** — there were real scenes of breaking, tuning, and retreating.
- The dead post's source was itself a **system description with no first-hand scene.** (It didn't even carry a `sourceIntake` pointer — a pure meta post.)

At least across our posts, when the source had no first-hand scene, even good agent writing turned into reconstructed exposition. The problem wasn't "an AI wrote it" — it was that **there was no first-hand scene.**

## Stealing from the biographer

Couldn't a human just write it directly from scratch? That didn't work. It was daunting. Sitting in front of a blank screen was a burden in itself.

While stuck on it, the biographer came to mind. A biographer or journalist doesn't sit the subject down and have them dictate a book. They **follow and interview** the subject to write it — throw a question, dig further into the answer, and weave scattered first-hand experience into prose.

So just flip the direction. Instead of putting the agent in front of a blank screen, put **the agent as the biographer and me as the source.** The one who holds the first-hand scenes is me, so let the agent dig them out of me.

## The real bottleneck wasn't the answer — it was the question

Here something I hadn't expected surfaced.

Writing alone is really doing three jobs **at once** — ① decide which questions to answer, ② answer them, and ③ work out the order to lay them out in. And the point where I got stuck wasn't ②. It was the kind where **I have things to say, but how to pull them out and in what order to make it a piece** is the fog. On top of that, just coming up with which questions to throw in the first place was itself a taxing job.

The interview splits those three. The agent takes ① the questions and ③ the structure, and I'm left with the one thing **only the human can do — answer what I actually lived through.** I just answered honestly, off the cuff, and a whole post came out. Having my rambling cleaned up and edited made it clearly easier than banging my head against a blank page.

But the more important part came next. **Being asked forces an immediate answer, and in that process thoughts I hadn't consciously formed got sorted out.** The interview didn't transcribe a piece that was already sharp inside me. The question — by forcing an answer — **excavated** a thought I didn't know I held.

This post is the proof. Answering "weren't you scared of fabrication?", I said out loud the distinction that it's not "scary" but "something an LLM obviously has to catch" — a distinction that came clear as I answered.

## Decisions / trade-offs

- **Use the agent as a biographer, not an author.** Put only an agent in front of a blank screen and, in our case, you got scene-less exposition. Have it interview the operator and a living source enters the prose — rather than cutting the human out, I put them back in the lightest way: just answering.
- **Human does only ②, the agent does ①③.** The bottleneck in writing was the questions and the structure, not the answer. What's left for the human is "answering what they lived," so peeling off the rest was the way to cut the burden.
- **The fabrication guard isn't the point — it's a premise.** Inventing detail is an intrinsic weakness of every LLM, so I treat it not as "scary" but as "obviously caught." That boundary is covered separately in [The benevolent lie](/en/blog/benevolent-lie-hallucination-en/) — this harness is about **restoring voice and removing the production bottleneck,** not truthfulness.
- **Don't hide the self-reference.** This post was written with that harness. Being transparent about the source is how you face down the suspicion that "an AI wrote it and is trying to look real."

## What's next

- Reuse the interview harness and codify which questions best dig out first-hand scenes.
- Formalize the diagnosis "the source decides whether a post lives or dies" into per-post source-note trust rules — merging with the record hierarchy (git → docs → infra logs → memory) from [The benevolent lie](/en/blog/benevolent-lie-hallucination-en/).

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please open a GitHub issue.
