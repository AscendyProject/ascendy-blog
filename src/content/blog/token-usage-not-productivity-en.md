---
title: "Spend fewer tokens, spend more — both companies are half right"
description: "'Token efficiency' and 'tokenmaxxing' look opposite, but both measure token volume — the AI era's overtime hours. The real axis is productivity on the bottleneck: set a generous cap, then judge results, not token count."
pubDate: 2026-06-26
author: "Ascendy Engineering"
tags: ["ai", "productivity", "token-economy", "measurement", "opinion"]
category: "meta"
lang: "en"
translationKey: "token-usage-not-productivity"
sourceIntake:
  - "docs/intake/from-user/2026-06-26-token-usage-not-productivity.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Two opposite cultures exist. **Token efficiency** (spend fewer tokens = competent) and **tokenmaxxing** (spend more = competent). One rewards saving tokens in reviews; the other treated token burn as a measure of innovation.
- They look opposite, but **both measure token *volume*.** Same error, reversed sign. It's the *AI era's overtime hours* — the token version of "whoever sits longest works hardest."
- I do the same work but spend tokens freely on my personal account and sparingly on my company one. It looks contradictory, but there's a reason — the **billing structure** and the **bottleneck structure** differ.
- The real axis isn't tokens. It's **whether the time those tokens buy sits on the organization's bottleneck.** So the right evaluation isn't measuring tokens directly — it's **setting a generous cap, and inside it judging productivity, not token count.**

> **About this piece.** This column came out of an interview (`/interview`) — the operator answered, an AI editor pressed, and the position developed. *Assertion* and *speculation* are kept apart (the bottleneck logic and the prescription especially are one operator's N=1 observation). No company name is used; public phenomena are cited as such.

## Two camps — efficiency and tokenmaxxing

As organizations started folding AI usage into evaluation, two opposite cultures emerged.

One is **token efficiency.** Doing more with fewer tokens is read as competence. One large company reportedly measures "how many people's worth of work one AI-using employee does" as a full-time-equivalent figure, and [added *output per token spent* as a secondary metric](https://www.khan.co.kr/en/article/202604290928017/) on top.

The other is **tokenmaxxing.** In Silicon Valley, token consumption was for a while treated as a measure of innovation capacity, with internal leaderboards built to encourage spending more. The result was [burning through budgets in a few months](https://www.epochtimes.kr/2026/06/753177.html) — waste — and it's now being walked back.

On the surface they're opposites. But step back and **both use token *volume* as a proxy for performance.** One says less is better, the other more, but they both *stare at the token count.*

## This is the AI era's overtime hours

Doesn't this setup look familiar? It's the **"whoever works the most overtime works hardest"** illusion.

Overtime hours are easy to measure. So they once served as a proxy for diligence. But we know now — *doing less and producing more* is best; sitting longer isn't ability. Token usage is the same. It became a metric only because it's easy to measure.

More honestly: **nobody yet knows the real standard for AI productivity.** With no standard, people cling to the number they can hold (tokens) — a transitional fumble. Just like overtime.

## Why the same person acts in opposite ways

Building a product solo, I spend tokens without hesitation on my personal account. On the company account, I save them. There are two reasons the same person behaves in opposite ways.

First is the **billing structure.** A personal subscription is flat, so you can spend fairly freely (honestly, today's subscription models appear — *my speculation* — to run at a loss; the user is being subsidized), while an enterprise plan bills in proportion to usage.

The second is more fundamental — the **bottleneck structure.** In a large organization, if one employee runs short on tokens and finishes a little late, it has essentially no effect on total revenue. And in a research-leaning function, a slipped schedule doesn't break the company. That one person isn't on the *critical path.*

My solo project is the opposite: **my speed *is* the organization's speed.** Because it's just me. If I slow down, the whole project slows, and at worst the output *never ships.* I'm a single point of throughput.

So the real value of a token isn't in the token count. It's in **how directly the time it buys sits on the organization's bottleneck.** Token efficiency and tokenmaxxing aren't *wrong* — each is a locally rational response to its own bottleneck structure. What's wrong is *forcing one axis (token volume) on everyone alike.*

## A cheap check wasn't a check

The easiest way to save tokens, honestly, is to hand the work to a cheaper, lighter model. So I tried slotting in the Gemini family — what I considered the best value — as an *adversarial code reviewer.* I gave it the exact same instructions (`AGENTS.md`) I gave other reviewers.

The limit was clear. When I had Codex re-review a PR that Gemini had "approved," real feedback came back. And even the Claude that wrote the code conceded it was a flaw *it had missed,* and fixed it. Same instructions — the model's weight class decided the outcome.

This is the point. **I used a cheap reviewer to save tokens, and saved barely any — while losing the most expensive thing, my *time*.** The cost of re-running a wrongly-passed review and catching the missed flaw later far exceeded the tokens I'd saved. A cheap check wasn't a check.

## That doesn't make efficiency wrong

Don't misread me. *More output with fewer tokens* is clearly best — obviously so, for whoever pays the bill. The *aim* of token efficiency is right.

There's a reason companies leaned into tokenmaxxing too. Push "save tokens" too hard and you get the opposite failure: people who *could* deliver instead hold back, or use *tokens as an excuse* not to. Tokenmaxxing was a reaction to that flinch. So both camps hold a partial truth and carry a side effect.

The trouble starts the moment you nail an *aim* directly onto an *evaluation metric.* Start measuring tokens directly and people optimize the *metric* instead of the work. Tell them to spend less and they flinch; tell them to spend more and they waste.

## So what's the right direction

Here's my answer. **Set a generous cap; inside it, let people spend tokens freely — and make the thing you evaluate productivity, not token count.**

That solves two things at once. The cap controls cost, so tokenmaxxing-style runaway is blocked. And inside it, people focus purely on results without *second-guessing* whether to spend more or less. Then **the optimal token spend isn't set by an evaluator — each person finds it as a result.**

It's the same principle as keeping regulation minimal and letting the market find the right price. The right token spend isn't a number to be fixed from above — it's an equilibrium that *emerges from working freely inside a constraint.*

When there's no measurement standard yet, the move isn't to force a fake metric on everyone. It's to **set the constraint and judge by results.** Just as we moved past the era of rating people by overtime hours, this era of rating them by token usage is a phase we'll move past too.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
