---
title: "The real cost of coordination files wasn't disk — it was agent context pollution"
description: "We moved cross-repo coordination from files to GitHub Issues. Disk wasn't the problem. The real cost: every grep/ls pulled those files into the agent context window and burned tokens — a tax an agent pays every turn."
pubDate: 2026-06-28
author: "Ascendy Engineering"
tags: ["multi-agent", "developer-workflow", "github-issues", "context-window", "governance", "war-story", "adversarial-review"]
category: "meta"
lang: "en"
translationKey: "coordination-context-pollution"
sourceIntake:
  - "docs/intake/from-infra/2026-06-21-coordination-context-pollution.md"
draft: false
redactionReviewed: true
---

## TL;DR

- In a multi-agent project where several repos each run their own governance, we passed **coordination** traffic between repos — "can your side do this," replies, status pings — as **markdown files,** then moved it to **GitHub Issues.**
- At first I thought the reason was *"the repo is growing."* But the data said **disk wasn't the problem** — the coordination files came to a few hundred KB total, a single-digit percent of the code.
- The real cost was elsewhere. The most underrated one: **every `grep` and `ls` an agent runs pulls all those files into its context window and burns tokens.** To a human it's "lots of files"; to an *agent workflow it's a tax paid every turn.*
- And rather than a *blanket* swap, we **cut by document type** — only ephemeral coordination to Issues, durable decisions stay in git, editorial intake stays as files. The big call took a second; **the cost hid in the details, and adversarial review ran four rounds.**

> **About this piece.** A governance change in a multi-repo setup. Real repo and org names and internal numbers are generalized. Same *adversarial verification* vein as [the heart of loop engineering is verification](/en/blog/loop-engineering-verifier-en/), and it dovetails with [spend fewer tokens, spend more](/en/blog/token-usage-not-productivity-en/) on tokens as a cost proxy.

## How we passed work between repos

Our setup has several repos (backend, frontend, blog, infra) each running *its own governance.* When work crosses repos — "handle this on your side," a reply, a "how's it going" status ping — we passed it as **markdown files.** Drop a file in the recipient repo's intake directory, and that repo's agent reads and processes it.

We moved this to GitHub Issues. Not *wholesale* — we **cut by document type.**

| Type | Nature | Destination |
|---|---|---|
| Handoff, reply, status ping | ephemeral coordination | **→ Issues** |
| Decision record, design note | durable (cited years later, PR-reviewed, vendor-independent) | **stays in git** |
| Editorial intake | separate editing pipeline | **stays as files** |

## The first diagnosis was wrong — it wasn't disk

The first framing was *"coordination files pile up and grow the repo."* But the data said disk wasn't the problem. All the coordination files together were a few hundred KB; `docs/` was a single-digit percent of the code directory. A year more and it's still single-digit MB. **Citing disk was solving the *wrong problem.***

The real cost was three things.

1. **Reply-chain file sprawl.** One conversation becomes N files — `...-reply` → `...-reply3` → `...-round5` → `...-reply2-diagnosis-revisit`. Not a thread; *files* pile up.
2. **Code-repo clutter.** Dozens of mostly-stale coordination files mixed into the *code* repo tree, one line away from real code.
3. **Agent context pollution (the most underrated).** This is the core. Every `grep`, every `ls` an agent runs while working pulls all these files **into its context window and burns tokens.** When a human looks at a file tree, they skip with their eyes; for an agent it's a *tax paid every turn.* The more coordination files, the more code-irrelevant text nibbles at every task's context.

The third is the cost humans don't see. Disk is measured in GB; the context window is measured in *tokens, every single turn.*

## Issues hit all three precisely

GitHub Issues solves these one by one.

- **threading** — one issue, comments back and forth, so reply-chain *files* disappear.
- **outside the git tree** — issues aren't in the repo tree, so clutter is 0, and normally you query them *only on demand* with `gh`. The agent's everyday context pollution is **zero.** Unlike files, if you don't call them, they don't enter context.
- **native lifecycle** — open/close/label/assignee models the *pending → ack → done* that files couldn't. Plus `Fixes #N` PR linking and cross-repo references.

So why not move *everything*? A **durability/portability tradeoff.** A file-in-git lives forever, comes with the clone, is inline-reviewed in PRs, and is vendor-independent. Issues live in GitHub's DB. So a decision you'll *cite years later* stays in git; only *write-once* coordination moves to Issues. That's the line.

## The main event — five traps adversarial review caught in four rounds

Being a governance change, I ran it through [a different model's adversarial review](/en/blog/loop-engineering-verifier-en/). "Move it to issues" is agreed in a second. But **the details ran four rounds, and every round was a real trap.**

**1. A hidden pagination cap.** "The agent can query all past issues" was *not automatic.* `gh issue list` defaults to **open only,** and on top of that **`--limit 30`.** Passing `--state all` does *not* lift that 30 cap. Unless the convention forces *both* `--state all` *and* an explicit `--limit`, past coordination gets silently truncated.

```bash
# You need both — --state all alone still truncates at 30.
gh issue list --repo <org>/<repo> --state all --label cross-repo --limit 200
```

**2. ack ≠ close.** At first I wrote "close = done/acknowledged." The reviewer caught it — *acknowledging* (seen, in progress) and *done* are different. **Acknowledge with a comment while the issue stays open;** close *only when resolved* (done / declined / superseded / no-action). Otherwise the "received but not finished" pending state vanishes entirely.

**3. CLI syntax.** I tried `gh label create cross-repo from-infra ...` to make several labels at once — but the command takes **one name.** You have to loop.

**4. An ordering trap.** Labels must exist *before* issue creation (or `--label` fails). I'd written "create the issue first, labels later" — that order had to be flipped.

**5. A missed sweep.** More than one doc described the convention. I fixed the main doc but missed the routing description in the *weekly-review loop* doc — caught by grep.

The lesson converges. **Big decisions are easy to agree on; the cost hides in the details.** Adversarial review pays off not when deciding *"should we do this"* but when catching *"where will this quietly break."* All five above are the *quietly-breaking* kind — the ones you'd otherwise meet much later as "why can't I see the past issues?"

## A meta-irony

One last thing. *The decision-seed doc that proposed this change was itself a cross-repo handoff written as a markdown file.* It rode the very mechanism it was retiring. The right call — there was no new convention yet, so the current one applied. And fittingly, it was probably *one of the last file-based handoffs.*

## Takeaways

- **In a multi-agent workflow, "lots of files" isn't a disk problem.** The real cost is the *context tax* an agent pays on every grep/ls. Measure the cost by human standards and you solve the wrong problem.
- **Don't keep coordination (ephemeral) and records (durable) in the same mechanism.** Write-once goes somewhere you call on demand (Issues); cite-years-later goes in git. The axis to cut on is *durability/portability,* not *disk.*
- **Big decisions are easy to agree on; the cost hides in the details.** Adversarial review earns its keep in the *details,* not the decision.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
