---
title: "I didn't design it — I delegated it"
description: "Someone asked how I designed the git branching for parallel agents. I didn't — I delegated it. The developer instinct 'how do I solve this' has to shift to 'how do I delegate this, and make the result trustworthy.'"
pubDate: 2026-06-30
author: "Ascendy Engineering"
tags: ["ai", "agents", "delegation", "loop-engineering", "redteam", "opinion"]
category: "meta"
lang: "en"
translationKey: "i-didnt-design-it-i-delegated"
sourceIntake:
  - "docs/intake/from-user/2026-06-30-i-didnt-design-it-i-delegated.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Someone asked: *"When you run work in parallel, how did you *design* the git branching so it doesn't tangle?"* My answer: **"I didn't design it. I delegated it to the agent."** I only throw tasks; the agent decides the dependencies, the order, and what can run in parallel.
- A developer's instinct is *"how do *I* solve this, which tech do I use?"* — trained over a lifetime. The question now has to shift: **"how do I *delegate* this? How do I make the result *trustworthy*?"**
- The trap is *"it's too complex, so I should do it / it hallucinates, so I should check it myself."* It sounds reasonable, but stop there and **the human becomes the bottleneck.** (I did this.)
- The fix is to move verification from *my job* to *a structure* — a harness, a loop. Then delegation isn't *letting go;* it's **moving where you hold on.**

> **About this piece.** A first-person record of how my thinking shifted while building a product solo. The person who asked, and my affiliation, are generalized. Same vein as [the heart of loop engineering is verification](/en/blog/loop-engineering-verifier-en/) and [Build in studying](/en/blog/build-in-studying-en/).

## "How did you design that?"

A colleague once asked, watching me run several tasks at an agent in parallel:

> "If you run work in parallel, the git branches will tangle — how did you *design* it so they don't?"

A good question. And one *the old me* would have answered at length — how to lay out a branch strategy, what order to resolve dependencies, how to prevent conflicts.

But my answer was this. **"I didn't design it. I delegated that too."**

I only throw tasks. *"Do this, this, and this."* Then what the dependencies between tasks are, what to do first and what later, which ones can run in parallel — I've built a harness so the agent makes *those* judgments too. He paused, then said: *"Oh… you delegate even that."*

That short reaction contained the whole difference in mindset.

## The developer's instinct is the biggest obstacle

His asking "how did you design it" is natural. **Developers are trained to meet a problem by first thinking *"how do I solve this."*** Which data structure, which architecture, which tech fits — we spent a lifetime deliberating that. It *was* the skill.

But in the age of AI, that instinct becomes the *biggest obstacle,* because the question has to change.

- **(before) How do *I* solve this?** → **(after) How do I *delegate* this?**
- **(before) Which tech do I use?** → **(after) How do I make the result *trustworthy*?**

This isn't a simple tool swap — it's *going against a habit,* so it doesn't change overnight. "How do I solve this" fires reflexively first. You have to consciously catch it and flip it to "how do I delegate this."

## Why "it's too complex, so I should do it" is a trap

The most common trap looks like this.

> *"This is too complex, so I should do it myself."*
> *"AI keeps hallucinating, so I should check this one myself."*

Both sound reasonable. It really is complex, and AI really does fail plausibly. So *it doesn't look like the wrong conclusion.* That's exactly where the trap is.

I did this at first too. Because AI lies and exaggerates, I kept fixing prompts and checking every result myself. But I soon realized — **doing that makes *me* the bottleneck.** However fast the work gets produced, if I have to review all of it, *my own hands are the ceiling.* Neither time nor labor efficiency improved. The point of using AI evaporated.

The conclusion of "complex, so me" / "hallucinates, so me" is — *holding everything forever, myself.* That's using AI as a *fast pair of hands,* not as *leverage.*

## So the direction of the question has to flip

From the same facts (it's complex, it hallucinates), you have to pull the opposite conclusion.

- "Too complex, so I should do it" → **"How do I break this complex thing down so it *can be delegated*?"**
- "It hallucinates, so I should check it" → **"How do I structure things so it *doesn't* hallucinate?"**
- And one step further → **"How do I build a structure that *improves itself*?"**

The crux is *moving verification from something I do to something the structure does.* Not "I should check it" but "how do I make it trustworthy *without* checking." Searching for that answer led me to [harnesses and loop engineering](/en/blog/loop-engineering-verifier-en/), and eventually to *building one myself.*

What I built is our open-source [redteam](https://github.com/AscendyProject/redteam). Putting a loop inside the harness and [verifying and improving its output by dogfooding](/en/blog/review-tool-caught-the-author-en/), it became a *tool I could trust.* And now I — **genuinely work only at the level of checking results and giving feedback, delegating most of it.**

## The structure of trust is cross-model verification

The device that makes a delegated result trustworthy isn't making one model smarter. It's having *a model from a different family cross-check the result.* The model that wrote the code rubber-stamps its own; a model from a different family has no reason to agree.

Tellingly, [Genspark](https://aigearbase.com/tool/genspark-ai) turned this idea into a product — routing work across several models (GPT, Claude, Gemini, and more) and *cross-verifying their outputs* (a Mixture-of-Agents structure). That's a signal that "cross-model verification" has become important enough to be *a product.*

But one note. **If you already subscribe to two or more models** (GPT, Claude, Gemini), you don't need a separate service — you can compose cross-verification *yourself* with a harness like redteam. Buy it as a service or wire it yourself; what matters is the structure where *a different set of eyes than the author does the verifying.*

## So do you delegate everything? No — you move where you hold on

Don't misread it. Delegation isn't *letting go.* It's not handing everything off and walking away; it's **moving the point where you hold on.**

Three things the human still holds: *deciding what to delegate,* *judging the result that comes back,* and *giving feedback on it.* I no longer hold "how do I implement this." Instead I hold "how do I make this delegable," and "is the result that came back any good." The point of control moved up — from *implementation* to *delegation design and judgment.*

So the thinking has to change. **Not "how do I solve this," but "how do I build the *structure* to delegate this."** Not designing the work, but designing the *structure that makes the delegated work trustworthy* — that's the seat developers have to move to now.

## Takeaways

- **Flip "how do I solve this" to "how do I delegate this."** The developer's instinct (I solve it) is the biggest obstacle in the age of AI.
- **"Too complex / it hallucinates, so I should do it" is a trap.** Stop there and the human becomes the bottleneck. From the same facts, pull the conclusion "how do I structure it to delegate / to not hallucinate."
- **The structure of trust is cross-model verification.** A different family of eyes than the author verifies. Buy it as a service or wire it yourself — the structure is the point.
- **Delegation isn't letting go; it's moving where you hold on.** Let go of implementation; hold *delegation design and judgment.*

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
