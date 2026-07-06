---
title: "Multi-agent isn't always the answer — so I asked an AI directly"
description: "Does adding more agents help? I asked an AI. It splits on one question — can parallel pieces succeed without knowing each other's decisions? Yes for reading and exploring; for writing one coherent thing, it backfires."
pubDate: 2026-07-05
author: "Ascendy Engineering"
tags: ["ai", "agents", "multi-agent", "architecture", "opinion", "loop-engineering"]
category: "meta"
lang: "en"
translationKey: "multi-agent-not-always"
sourceIntake:
  - "docs/intake/from-user/2026-07-05-multi-agent-not-always-the-answer.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Stacking on more agents *feels* like it should help — but it *isn't always the answer.* Whether multi-agent fits comes down to one question: **can the parallel pieces succeed without knowing each other's implicit decisions?**
- **If they can** (reading and exploring broadly), multi-agent wins. **If they must know** (writing one coherent artifact), it backfires. The skeptic (Cognition) and the advocate (Anthropic) are really *two ends of the same axis.*
- So "cross-model verification" is no contradiction — **you gather context when writing (single writer) and strip it away when judging (independent check).** These are separate jobs exploiting opposite properties.
- Adding more gets worse because of three taxes: *coordination, context fragmentation, error compounding.* Past a threshold it slows down and errs — like an 8-person meeting.

> **About this piece.** This is a write-up of a **dialogue where I asked an AI and the AI answered** (an interview run in reverse). So the *present-fact claims* the AI made (who shipped what, the numbers) are web-verified with links, and the *reasoning* is labeled as reasoning. The scope here is software (LLM) agents. Same vein as [the heart of loop engineering is verification](/en/blog/loop-engineering-verifier-en/) and [I didn't design it — I delegated it](/en/blog/i-didnt-design-it-i-delegated-en/).

## It all splits on one question

Multi-agent is having a moment. Wire up several agents in parallel and surely things get faster and smarter. So I got curious — *is that really always true?* I talked it through with an AI at length; here's what I took from that conversation.

The first answer was already sharp. Whether multi-agent is the answer splits on **one question**:

> When you break work into parallel pieces, can those pieces succeed **without knowing** the judgments the others made?

- **They can** → multi-agent is favorable
- **They must know** → multi-agent is poison

That single line is the spine of this whole piece. In fact, the two famous positions on this topic — the skeptic [Cognition's "Don't Build Multi-Agents"](https://cognition.com/blog/dont-build-multi-agents) and the advocate [Anthropic's multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — look like they clash head-on, but they're really *two ends of the same axis.*

## When it fits and when it doesn't

### Where multi wins — reading broadly

Anthropic's research system is exactly this case. A lead agent spins up 3–5 subagents in parallel to search from different angles, and they **return only compressed summaries.** Each subagent has its own context window and *doesn't need* to know the others' intermediate state. It's breadth-first reading, so the pieces don't collide.

The performance is real — on their internal eval, this beat single-agent Claude Opus 4 by **90.2%.** But there's a price: **roughly 15x the tokens.** So Anthropic is blunt about it: only *high-value* work — legal due diligence, competitive intelligence, literature review — can absorb that multiplier; everyday Q&A cannot.

So the three conditions where multi wins:

1. **Read-heavy and exploratory.** Gathering information broadly.
2. **Cleanly decomposable, pieces that don't collide.**
3. **High-value enough to absorb the 15x cost.**

### Where multi loses — writing one coherent thing

The opposite case is writing code. Cognition's famous **Flappy Bird example** — one subagent builds a Mario-style background while another builds a bird that doesn't match the game's assets. Both missed the other's *implicit design decisions.* Glue them together and you get a Frankenstein.

If you have to produce a single coherent artifact, or the work is sequential where an earlier decision shapes a later one — the moment you split the context finely, information leaks. Cognition calls this "context is fragile" and recommends a **single thread + (when needed) a dedicated compression LLM.**

### So where the industry actually converged

Here's the interesting part: the skeptic (Cognition) and the advocate (Anthropic) actually meet at the same *deployed* shape — not the naive symmetric kind:

> **One orchestrator holds the full context and spins up ephemeral, isolated subagents like scouts, getting back only compressed summaries.**

That is, the naive multi-agent where peers freely work in parallel mostly fails, and what survived is **"one orchestrator + N disposable scouts."** This is an *extension* of a single agent, not symmetric multi-agent.

## Isn't "cross-model verification" a contradiction?

Here comes the objection. Our open-source [redteam](https://github.com/AscendyProject/redteam) uses a structure where *a model from a different family cross-checks the result.* That's more than one agent too — so isn't it hypocritical to criticize multi-agent while using it?

Not at all. This is actually the crux, because **the single word "multi-agent" points to two opposite things.**

| | Parallel labor (division) | Independent check (crossing) |
|---|---|---|
| What | Splits the writing | A different set of eyes judges the result |
| Shared context | **Needed** (breaks without it) | **Must be absent** (pointless with it) |
| Failure mode | Flappy Bird | Self-review = rubber stamp |

Division breaks on the **writing** side — parallel writers who don't know each other's implicit decisions turn into a Frankenstein. The cause is the *absence of shared context.*

But cross-model verification is on the **judging** side, and here the sign flips — **not sharing context isn't a bug; that's precisely the feature.** The model that wrote the code rubber-stamps its own, because re-judging its own decision yields the same conclusion. A model from a different family has no reason to agree. The value of verification comes not from *count* but from **independence.**

And redteam actually stands on the side Cognition said was right. Its pipeline runs plan → implement → review as **sequential phases,** and one task's code is written by **one writer.** It doesn't split into parallel writers. That's Cognition's **single-threaded linear agent** principle — one writer holding the context throughout — with a *different-model independent reviewer* laid on top.

So the rule compresses to one line:

> **Gather context when writing (single writer); strip it away when judging (independent check).**

"Should I use multi-agent or not" is the wrong question. The right one is *"is this step writing or judging?"* — and the answer differs per step.

## Why more gets worse past a point

So why not just keep adding? Every added agent brings **three taxes.** Early on the added agent's benefit beats the tax, but past a point the tax eats the benefit.

1. **Coordination tax.** More agents means more touchpoints to reconcile — naively connect every peer and communication paths blow up roughly as *n².* The "one orchestrator + N scouts" star shape exists precisely to drop that n² to n.
2. **Context-fragmentation tax.** Each subagent sees only its own window. **No one sees the whole thing end to end.** Information passes only as compressed summaries, and compression is loss. Flappy Bird is exactly this tax detonating.
3. **Error-compounding tax.** One subagent's wrong premise *merges* with another's output and amplifies. And as Anthropic observed, agents can run away — spawning dozens of subagents for a simple query, or scouring the web endlessly — so waste piles up on top of that 15x baseline. Both cost and error compound.

**So the threshold is defined like this:** the moment an added agent's *marginal benefit* drops below the *coordination + fragmentation + error tax* it injects. Flip that inequality and it "starts to slow down and err." Reading broadly has a high threshold (five scouts still pay off); writing one coherent thing has a very low one (even two is already a loss).

The intuition is like **adding people to a meeting.** An 8-person meeting doesn't always decide better than a 2-person one — the added brains' benefit gets eaten by communication overhead. *(An analogy. Same vein as software's Brooks's Law, but not a rigorous citation — just for intuition.)*

## Bonus: the trap in the word "multi-agent"

A reader recently asked — *"In fields where more production automation is expected, like factories or engineering design, multi-agent doesn't seem to be considered yet — what's your take?"* I've never actually worked in that domain, so I didn't answer off the cuff. But the question itself sharply reveals one thing.

**"Multi-agent" is a word that points to two completely different worlds.** One is the *LLM multi-agent* this piece is about; the other is the *Multi-Agent System (MAS) of industrial control* — robot swarms, distributed control — a separate field decades old. Same word, opposite maturity, so the same sentence flips its answer depending on which world you mean.

So when a question like that comes, the right move — before inventing an answer — is to check *which multi-agent* is meant. Not pretending to know a field you don't: that itself is the stance this series tries to keep.

## Takeaways

- **It isn't always the answer.** Fit splits on "can the pieces succeed without knowing each other's implicit decisions?" Reading/exploring → multi; writing one coherent thing → single (+ long context).
- **Real-world multi isn't symmetric.** "One orchestrator + N disposable scouts" — an extension of a single agent, not peers running free.
- **Cross-model verification is no contradiction.** Gather context when writing; strip it when judging. Its value is independence, not count.
- **There's a threshold past which more gets worse.** The moment coordination, fragmentation, and error-compounding taxes exceed the marginal gain. Picture an 8-person meeting.

Honestly, most of this piece was answered not by me but by an AI. Yet verifying those answers — and drawing the line between where fact ends and reasoning begins — was still the human's job. Maybe that's the smallest working example this piece has to offer.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
