---
title: "The product and the tool grow each other — the virtuous loop in how I work"
description: "I built a tool to build a product. Then the agents building it hit friction — which becomes an issue, improves the tool, improves the product. Not the loop inside the harness, but one level up: an org I designed."
pubDate: 2026-07-08
author: "Ascendy Engineering"
tags: ["ai", "agents", "workflow", "dogfooding", "multi-agent", "opinion"]
category: "meta"
lang: "en"
translationKey: "product-and-tool-grow-each-other"
sourceIntake:
  - "docs/intake/from-user/2026-07-08-product-and-tool-grow-each-other.md"
draft: false
redactionReviewed: true
---

## TL;DR

- I built a product (Ascendy), and to build it better I built a tool — the open-source review harness [redteam](https://github.com/AscendyProject/redteam). Then, using that tool on the real product, **a virtuous cycle emerged where the tool and the product grow each other.**
- One turn goes like this: *an agent building the product hits friction using the tool → files an **issue** in the tool's repo → the tool's owner-agent judges it and fixes it → the improved tool makes the next product task smoother.*
- If [loop engineering](/en/blog/loop-engineering-verifier-en/) is the verification loop *inside* the harness, this is a loop one level up — **an org I designed, running outside the harness.**
- The strange part: this loop runs so well that **I don't even hold the provenance — "which friction became which issue."** That knowledge is scattered across the agents; I only sit where it's designed and routed.

> **About this piece.** A first-person account of how I've organized my work, pulled out in an interview. This is my way, not a verdict. I deliberately don't cite specific issue numbers — because I don't hold that provenance, and that fact is itself the point. Same vein as [coordination belongs in issues, not files](/en/blog/coordination-context-pollution-en/) and [I didn't design it — I delegated it](/en/blog/i-didnt-design-it-i-delegated-en/).

## Two loops

I once wrote about [loop engineering](/en/blog/loop-engineering-verifier-en/). That loop lived *inside the harness* — an AI writes code, a different model verifies it, it gets fixed, it goes around again. **A loop the AI runs.**

But looking at how I work these days, there's *another* loop, different from that one. Not inside the harness but **outside** it; not run by an AI but by **an org I designed.** You could call it a loop in the larger sense.

The story starts here. I'm building a product (Ascendy). To build it *better,* I built a review harness (redteam) as a tool. And once I started using that tool on the actual product work, a cycle started turning: **the tool makes the product better, and the friction that surfaces while building the product makes the tool better.**

## How one turn goes around

Concretely, one turn of this cycle runs like this:

1. **A product agent uses the tool.** I tell the agents that own backend and frontend: "use redteam to implement this."
2. **Friction surfaces.** While using the tool, if those agents hit something, they report to me: *"this looks like a harness problem, not a product problem."*
3. **I route it to an issue.** I tell that agent: *"then file it as an issue in the redteam repo."*
4. **The tool's owner-agent gates and fixes it.** The agent that owns redteam reads the filed issue, *judges its validity,* and if it's genuinely a harness problem, fixes it — verifying that fix with the tool itself (dogfooding).
5. **The improved tool makes the next product task better.** The version-bumped tool makes the next product work a little smoother, and *that* surfaces the next friction.

And it keeps turning. The more I build the product, the better the tool gets; the better the tool gets, the easier the product is to build.

## Why not fix it inline — why route it into an issue?

This might look odd. The agent that hit the friction could just *fix it on the spot.* Why bother **filing an issue** and handing it to another agent?

**Because a record has to persist.**

Agent sessions reset at any time. Context evaporates, and the next session has no idea what happened. But if that friction and judgment *live in an issue,* then one line to the reset session — **"read that issue"** — restores the context. In other words, the primary reader of this record isn't me, the human; it's **the agent on the other side of a reset.**

I used to accumulate this as documents committed to GitHub. Then at some point I thought — *do I really need to?* GitHub already has a fine tool: the **issue tracker.** It has state (open/closed), threads, and cross-references. Instead of stacking docs by hand, I could just use the good tool that already exists. (Same root as [moving file-based coordination into issues](/en/blog/coordination-context-pollution-en/).)

## Why let an agent, not me, judge validity

Another point. Deciding whether a filed issue is *actually worth fixing* is done by the **tool's owner-agent,** not me. Why put that gate on an agent instead of a human?

I designed it that way from the start. I planted three things in each agent:

- **(a) The whole project's context** — what we're building.
- **(b) Its own role** — you're backend, you're frontend, you own the tool (redteam).
- **(c) The fact that the other role-owning agents exist** — each knows the others' roles.

With those three in place, routing *just works.* The product agent knows "this is a harness problem, so it goes to the tool's owner"; the tool's owner-agent knows "this is mine, so I judge its validity." Putting the gate on the tool's owner-agent isn't improvised — it's because **I designed this small org that way.**

## So the human's seat moves up

Here's what I find most striking. To write this piece, I tried to cite a concrete case — *which product friction became which issue* — and **I don't know.**

That's not my knowledge; it's *the knowledge of the agents who filed the issues.* I designed and routed the rule "if it looks like a harness problem, leave it as an issue," but which friction led to which issue — that provenance isn't in my head. That knowledge is **distributed across the agents.**

I think this is what [delegation pushed to its limit](/en/blog/i-didnt-design-it-i-delegated-en/) looks like. The point where the human holds on has moved from *implementation,* past even *the history of the implementation,* up to **the org's design and routing.** I don't *run* the loop; I *design the loop so it runs.*

## But is it really virtuous — why it doesn't spin in place

An honest question. Since I build the tool myself, couldn't I fall into the trap of *polishing the tool instead of building the product* (yak-shaving)?

Two mechanisms prevent that.

- **It's parallel.** All of this is split across agents, so while the tool is being fixed, *the agents building the product don't stop.* Repairing the tool doesn't halt product development.
- **There's a validity gate.** Not every reported friction gets fixed. The tool's owner-agent filters "this is a real harness problem / this isn't." So not every complaint becomes a version bump.

With those two in place, this loop isn't a *hamster wheel* — it actually moves forward, a **virtuous cycle.** At least in my case, for now.

## Takeaways

- **Run the product and the tool together.** Use the tool you built to build the product *on that very product.* The product improves the tool, the tool improves the product.
- **Don't fix friction inline — leave it as a record.** Sessions reset. An issue lets the next session read and restore — the reader of the record is the next agent, not the human.
- **Design your agents as an org.** Plant the whole context + each one's role + the existence of the others, and routing and gating just turn.
- **To avoid spinning in place: parallel + a gate.** Keep tool repair from halting the product, and filter friction by validity.

Honestly this too is my current way, not a verdict. But putting a loop into *the way of working itself,* and moving the human from *running* the loop to *designing* it — that's the best way I've found, so far, to run a product and its tooling together, alone.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
