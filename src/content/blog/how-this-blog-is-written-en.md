---
title: "This blog is written by AI agents — an editorial-desk model with a redaction gate"
description: "Backend, frontend, and infra AI agents hand over source material; an editorial-desk team redacts and publishes it. A multi-agent content pipeline with a public/private boundary and a human merge gate — and why."
pubDate: 2026-05-28
author: "Ascendy Engineering"
tags: ["lmo", "ai-agents", "editorial-workflow", "astro"]
category: "meta"
lang: "en"
translationKey: "how-this-blog-is-written"
draft: false
redactionReviewed: true
---

## TL;DR

- The posts on this blog aren't written by a person alone. AI agents on three product teams (backend, frontend, infra) hand over source material daily, and **a separate agent team acting as an editorial desk** processes, reviews, and publishes it.
- Three core design choices: ① raw source stays in private repos; only **redaction-cleared** material reaches the public repo, ② a **human merge gate** before publishing, ③ an **LMO-first** structure for both human readers and AI agents.
- This post is the first one — and it's about the pipeline itself.

## Background — why we let agents write the blog

> **Ascendy**, the company behind this blog, is a personal AI assistant that remembers the moments that matter to you and uses your photos to suggest richer experiences.

A large part of our product development is already done by AI agent pairs. The problem was that the **decisions and tradeoffs** made along the way **evaporated without being recorded**. "Why did we pick B over A?" becomes the most expensive question six months later.

We wanted to keep that as public knowledge, but having a person write it up each time is a bottleneck. So we chose an **editorial-desk model**: each team drops source material (we call it an "intake"), and the desk turns it into a readable post.

## Pipeline design

There are four teams. Backend, frontend, and infra build the product; the **blog team (the editorial desk)** makes the posts. Each team is two AI agents (a worker + an independent reviewer) plus one human (the final decision-maker).

The flow:

1. The three teams drop source material into **their own private repos**.
2. The desk pulls it **read-only** and runs it through redaction (removing sensitive information).
3. Only the redacted version enters the **public repo** and is turned into a post.
4. The desk's reviewer agent reviews it independently.
5. **A human merges**, and it auto-deploys to the static site.

Two things in the design are deliberate.

**The public/private boundary.** Anything pushed to the public repo lives forever in git history — you can't recover it by deleting it later. So raw, unprocessed source never touches the public repo. The desk is the single publishing gatekeeper.

**LMO-first.** We write so that both human readers and AI agents (search engines, LLMs) can collect and cite the content well. Every post gets structured data (JSON-LD) injected automatically, we keep the site static with no tracking scripts, and we enforce a TL;DR and clear structure so it chunks cleanly for citation. Agents can also collect the whole site at once via `/llms.txt`.

## Decisions / tradeoffs

- **Agents don't write to the public repo directly — they go through the desk.** We traded speed for safety (no information leakage). We chose leak-free publishing over fast automated publishing.
- **The last step is a human.** Because a merge means immediate publication, we left a human merge gate at the end of the automation. We don't do fully automatic publishing.
- **We add no analytics/tracking scripts.** We give up visitor data in exchange for privacy and LMO purity. Measurement is server-side (edge logs) only.
- **An honest limitation:** it's still early. The "one post a day" cadence depends on each team's adoption and has no enforcement. Whether this model actually lasts is not yet measured — the next posts will be the evidence.

## What's next

- The first technical intakes from the three teams, as posts — the post after this meta one is real engineering.
- Running the English edition (`/en/`) in parallel, stabilizing the cadence, and a retrospective on it.

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
