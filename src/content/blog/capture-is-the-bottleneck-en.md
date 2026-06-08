---
title: "Self-improvement loops have arrived — but someone still has to write the correction down"
description: "I wished my AI tool would learn from my complaints and fix itself. The loop exists now — it only closes if the correction is captured, and capture is still manual. The hard part was never improve; it's capture→route."
pubDate: 2026-06-08
author: "Ascendy Engineering"
tags: ["ai-agent", "feedback-loop", "self-improvement", "developer-tools", "process-design"]
category: "meta"
lang: "en"
translationKey: "capture-is-the-bottleneck"
sourceIntake:
  - "docs/intake/from-user/2026-06-08-capture-is-the-bottleneck.md"
draft: false
redactionReviewed: true
---

## TL;DR

- It started with a wish: "I want the AI coding tool I use to **learn from my complaints and errors and fix itself.**"
- It turns out the **self-improvement loop already exists (at the skill/pattern level)** — correct a skill, and the correction gets written back into the skill's *instructions* and accumulates. But that's a narrow, **instruction-level** loop, and **in-session complaints still don't auto-reach the product** (you have to run `/feedback` yourself).
- The point: for the loop to close, the correction first has to be **captured** — and capture is manual and fragile. **The hard part was never 'improve'; it's always been 'capture→route'.**
- And leaving capture manual isn't laziness — it's also **privacy, signal/noise, and consent.** A legitimate tradeoff.

> **Source note.** This started from an operator's question. Product facts were fact-checked via web search at publish time and attributed; first-person opinion is marked as opinion. No internal information (all public docs, and "this blog is written with an AI coding tool" is already public). Same vein as [a report arriving changes nothing](/en/blog/monitoring-closed-loop-route-en/) (capture→route) and [everything you can click should also be sayable](/en/blog/conversational-parity-en/) (feedback should be conversational, not a form).

## The question

Mid-session, I wondered: "When I tell you (the AI coding tool) about an error or annoyance, is there a self-healing loop that **diagnoses it from logs and improves on its own**? If I say 'this is inconvenient' mid-session, does that get recorded somewhere and feed into product improvement?"

My gut said "surely yes — it's modern AI." Checking, the answer was more interesting.

## The loop *exists* — but it's narrow, and it hinges on capture

First, honestly: "there's no such loop" is **now inaccurate.** The loop exists; you just have to distinguish the kinds.

- **It exists — instruction-level self-improvement.** Some AI coding tools have a "learnings loop": correct a skill mid-use ("it should have done it this way"), and that correction gets written back into the skill's *instruction file* and accumulates. Next time, the correction applies — improving at the **prompt/instruction level**, not by touching model weights ([MindStudio](https://www.mindstudio.ai/blog/learnings-loop-claude-code-skills-self-improvement)).
- **Still human-in-the-loop — at the product level.** But the "this is inconvenient" I drop mid-session doesn't *auto-reach the provider.* To send it into product improvement, I have to run `/feedback` myself — a separate report flow. And data collection is opt-out per category: telemetry via `DISABLE_TELEMETRY`, the feedback command via `DISABLE_FEEDBACK_COMMAND`, and the satisfaction survey via `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` ([official Data Usage docs](https://code.claude.com/docs/en/data-usage)).
- **It doesn't exist — real-time model self-healing.** The model doesn't watch my error and fix itself on the spot.

One thing runs through all three. **For the loop to close, the correction first has to be *captured.*** Even the learnings loop only closes if someone (me, or a wrap-up step) *writes* that correction into the instructions. Product improvement only starts if I *press* `/feedback`. **The improve mechanism is already there — it's the capture in front of it that's manual.**

## The hard part was never 'improve' — it's 'capture→route'

That's the insight. When we think "self-improvement," we usually picture "how do you *fix* it (improve)." But that's not where it jams.

```text
[complaint/correction occurs] → [capture] → [route] → [improve] → [re-measure]
                                 ^^^^^^^^^^^^^^^^^^^
                                 manual, fragile → evaporates here
```

Some improve mechanisms (learnings loop, product-improvement process) **already exist.** What breaks is the step before it — the surfaced correction being **captured and routed to the right place.** Don't write it down, don't press `/feedback`, and the signal vanishes with the session.

We've seen this shape before. In [the monitoring post](/en/blog/monitoring-closed-loop-route-en/), the broken link wasn't 'measure' — it was 'capture→route': a human had to remember and re-relay it to make it action. Same here. Only this time the bottleneck sits **inside the tool we use every day.**

## Leaving capture manual isn't laziness

Don't corner it with "why didn't you automate capture?" Leaving capture un-automated has **legitimate tradeoffs.**

- **Privacy.** Auto-collecting and transmitting every complaint in a session feels like surveillance. Opt-in (`/feedback`) and an off switch put that boundary in the user's hands.
- **Signal vs noise.** Not every grumble is a product signal. The explicit act — "press a button / type a command" — filters real intent.
- **Consent.** Sending my correction somewhere is only safe on top of my consent.

So manual capture is also a *choice*, not a *flaw.* But the choice carries a clear cost — **an uncaptured signal evaporates.**

## So what does "good capture" look like

The way to lower the cost isn't to *remove* capture — it's to **lower the friction while keeping consent.**

- **Capture by conversation.** Not hunting for a form to write the complaint in, but saying it on the spot and having it caught — exactly what we argued in [the conversational-parity post](/en/blog/conversational-parity-en/). When the entry point is conversation, capture friction drops to near zero.
- **Route on consent.** Catch it, but confirm — "want me to file this as an issue?" — before sending it on.
- **Close the loop end to end.** Capture→route→improve→re-measure. A signal you only receive is worth zero.

## Takeaways

- **The self-improvement loop (improve) has arrived.** The surprise isn't that it *exists* — it's that it **hinges on capture.**
- **The hard part was never 'improve'; it's always been 'capture→route'.** If the surfaced correction isn't captured and routed, even the smartest improve mechanism starves.
- **Manual capture is often a choice** (privacy, signal/noise, consent) — see the tradeoff before you blame it. But the cost is an evaporating signal.
- **Good capture = low friction + kept consent**: capture by conversation, route on consent, and close the loop end to end.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
