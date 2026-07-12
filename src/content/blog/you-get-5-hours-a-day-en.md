---
title: "You get 5 hours a day. AI uses the other 19."
description: "A working person gets about 5 usable hours a day; the other 19 are wasted. AI uses those 19 — for cents an hour. But it pays off only if you first build a fulcrum: verification. Without it, it's negative leverage."
pubDate: 2026-07-12
author: "Ascendy Engineering"
tags: ["ai", "leverage", "productivity", "agents", "career", "opinion"]
category: "meta"
lang: "en"
translationKey: "you-get-5-hours-a-day"
sourceIntake:
  - "docs/intake/from-user/2026-07-12-you-get-5-hours-a-day.md"
draft: false
redactionReviewed: true
---

## TL;DR

- The time a person can *purely* use in a day is, generously, about **5 hours** (subtract sleep, meals, a day job, commute, breaks, bathroom). The other **19 hours were being wasted** anyway.
- **AI uses those 19 hours.** And it's cheap — all the subscriptions together cost about $5 a day, *a few hundred won per hour.* If someone asked "would you pay a few hundred won for one extra hour a day," most would pay far more. And this is 19 hours.
- So AI isn't a tool — it's **leverage,** on the one axis no one can buy back: *time.*
- But there's a twist. It didn't work from the start. **Before I built a fulcrum — verification — it was *negative* leverage:** it amplified my losses. Only after building the fulcrum did it flip positive.

> **About this piece.** A first-person account pulled out in an interview. "Leverage" is my *bet,* not a verdict. The 5-hour math is for a *typical office worker,* and the subscription prices are mid-2026 and change often. Same vein as [I didn't design it — I delegated it](/en/blog/i-didnt-design-it-i-delegated-en/) and [token usage is not productivity](/en/blog/token-usage-not-productivity-en/).

## The one axis you can't buy back: time

The word "leverage" has several senses. For me, one of them dominates why AI is leverage — **time.** You can earn money and grow skill, but *no one can buy time back.* And people use far less of it than they think.

Let's subtract. A day is 24 hours. For a typical office worker:

- Sleep, 6 hours → 18
- Three meals, 2 hours → 16
- Day job, 8 hours → 8
- Commute, 1.5 hours → 6.5
- Coffee and breaks, 1 hour → 5.5
- Bathroom trips, 0.5 hours → **5**

Even under the fairly harsh assumption that you do *nothing else,* the time you purely secure on a weekday is **5 hours** — and that's for someone whose commute is under 90 minutes. So of 24 hours, only 5 are truly yours to use, and **the other 19 were being wasted** anyway.

## AI uses those 19 hours — and cheaply

This is where AI comes in. Put AI to work and you can use **those 19 hours you couldn't.** Code runs while you sleep, while you eat, while you're doing your day job.

Look at the cost. All these subscriptions together run about **$150/month** — Claude Max about $110 (that's with Korea's 10% VAT), plus ChatGPT and Gemini subscriptions at roughly $20 each. Divide by the day and it's **about $5.** *(Mid-2026, VAT-inclusive in Korea; prices change often.)*

At $5 a day for 19 extra hours, that's **under 30 cents an hour — a few hundred won.** If someone asked "I'll get you one extra hour a day, will you pay a few hundred won," most people would pay *far* more; time is that precious. And this isn't one hour — it's **19.** There's no reason not to.

In practice, I now hand tasks to Claude Code, Codex, and Gemini before bed. Code gets worked on while I sleep, and in the morning I check the PRs that came up and merge. Bathroom breaks, coffee breaks — work moves in all those gaps too.

## But — at first it was actually a loss

Hearing only this, it sounds like "just subscribe to AI, then." No. **This wasn't possible for me from the start either.**

Early on it was closer to *negative* leverage. Code got implemented in the wrong direction, or turned into a mess. Then *fixing it took even more time.* An anxiety about code correctness always lurked, and in the end I had to hold and review all the output myself. **A lever amplifies not only good judgment but bad results, equally.** Pull the lever without a fulcrum and what grows isn't the gain — it's the loss.

## Only after building the fulcrum did it flip positive

What changed. I spent **about a week building a review harness (redteam).** Once I started working with it, the game changed.

- **Claude writes the code, and Codex reviews it.** In almost every case Codex caught the wrong parts *sharply.*
- **Even the fixing got automated.** I no longer had to hand-correct everything it caught.
- **The harness parallelizes appropriately, accounting for task dependencies and priority.**

The result: **the time I spend on verification dropped dramatically.** And efficiency and code quality rose *together.* Where I used to hold all the output out of anxiety, a trustworthy verification layer now does that job.

This is the crux. **The fulcrum of the leverage is verification.** When the fulcrum is low, the 19 hours become a pile you have to clean up; when it's high, the 19 hours become output as-is. That week of investment was spent *raising the fulcrum.*

## So my 5 hours direct 19 machine-hours

So here's what my day looks like now. **My 5 hours of judgment direct 19 hours of machine work.** I set the direction, check the results, and delegate the rest.

This morning was like that. All I did on waking was read the Codex review on a PR that came up overnight and merge it, then read our blog's visitor report over coffee. That was it. **It genuinely feels like working like a company's owner** — not doing everything myself, but sitting where you give direction and look at results.

Of course there's a ceiling. Those 19 hours aren't infinite — the ceiling is **as much as I can verify and merge.** So the higher I raise the fulcrum (verification capacity), the more of the 19 hours I can turn into output.

## And that's why the gap widens

Here comes the second sense of leverage — **the gap.** Same 24 hours, same $5 a day, and yet the result differs completely from person to person.

For someone who built the fulcrum, AI is *positive* leverage — 5 hours work like 24. For someone pulling the lever without a fulcrum, it's *negative* — cleaning up what raw AI spat out eats another few hours. So the gap between them doesn't narrow over time; it *widens.* AI being handed out equally doesn't make results equal — it **tilts toward whoever built the fulcrum.**

## Takeaways

- **AI is time leverage.** It stacks the wasted 19 hours onto your 5 — at a few hundred won an hour.
- **But build the fulcrum first.** If verification isn't trustworthy, the 19 hours are a pile to clean up — that's negative leverage.
- **The fulcrum is verification.** I spent a week building a verification harness, and only then did the lever flip positive.
- **The gap widens.** Same AI, same $5 a day, and the result tilts toward whoever built the fulcrum.

Honestly this too is my bet, not a verdict. But see AI only as a "tool" and you stop at some-cents-an-hour convenience; see it as "leverage" and you start asking *where to place the fulcrum.* That difference, I think, is what separates a 5-hour day from a 24-hour one.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
