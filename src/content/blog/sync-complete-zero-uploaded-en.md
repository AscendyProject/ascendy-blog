---
title: "It said 'Sync complete' — and uploaded zero. Silent success is the dangerous one"
description: "Photos wouldn't sync, yet the app said 'complete' — zero uploaded. The frontend ranked 9 hypotheses from code and hit the backend's answer: a client scan cap. Then a reviewer caught a data-distribution bug in the fix."
pubDate: 2026-06-21
author: "Ascendy Engineering"
tags: ["debugging", "silent-failure", "code-review", "frontend", "data-distribution"]
category: "frontend"
lang: "en"
translationKey: "sync-complete-zero-uploaded"
sourceIntake:
  - "docs/intake/from-frontend/2026-06-17-sync-complete-zero-uploaded.md"
draft: false
redactionReviewed: true
---

## TL;DR

- The operator reported: "photos taken after a certain date won't sync." Yet the app showed a **"Sync complete" toast** — with *zero uploaded.* **Silent success** is the most dangerous failure mode.
- With **no access to the backend's prod logs**, the frontend independently **ranked ~9 hypotheses** from code alone — and its #1 suspect was later **observed verbatim** in the prod logs the backend brought.
- But that was the *secondary* bug. The **real cause was a client scan cap** — the client scans only the "newest N" items, so once the library exceeds that cap, newer photos beyond it are *invisible to the scan* and never reach the server at all.
- The fix — chunked sync — was solid, but an **independent LLM reviewer caught a data-distribution bug inside it** — one that no lint or test can see, the kind you only catch by *imagining the data.*

> **Source note.** Distilled from two frontend-team intakes (independent diagnosis & convergence / root-cause fix & reviewer catch). Internal identifiers, absolute numbers, API paths, and DB names are generalized (only the product fact — it syncs a photo library — is public domain). Same *silent failure* vein as [the Celery worker that logged not a single INFO line](/en/blog/celery-silent-info-logs-en/).

## The symptom — "complete," and zero

The operator reported: "photos taken after a certain date won't sync, auto or manual." Yet on screen, a **"Sync complete"** toast appeared. No error, no failure indicator. With, in fact, **not a single photo uploaded.**

This is the nastiest kind of debugging. A *loud failure* at least hands you a stack trace. A **silent success** says "all done" while doing nothing — it won't even tell you where to start. This regression was the third round that month, each time handed off with a different candidate cause.

## Part 1 — 9 hypotheses, from code alone, with no prod logs

The frontend made a call: *don't wait for the backend's prod logs — start diagnosing with what we have (the code).* Waiting for the operator's device-log capture would have delayed the first containment by days.

So, from code alone, it **ranked ~9 hypotheses by suspicion.** The top two:

- **A parallel sync race** — if auto-sync and the manual button *both* start a sync, the server interrupts the first session and rebinds all pending items to a new one → the first session's completion becomes a silent no-op.
- **An invisible start failure** — if a sync start fails, it only logs to the console and returns quietly. Neither the user nor a logfile knows.

All nine candidates fell into the "fixable by the frontend alone" category. So it closed three of them in one PR — a single-entry lock against parallelism, removing a bug where a cancel flag permanently silenced every background listener, and surfacing the last sync error in the UI.

## Two diagnoses met in the same prod log

A few days later, the backend brought structured prod logs and DB counts. Three things were settled at once.

1. **New photos weren't *reaching* the server at all.** Of the hashes the client sent, zero were new. So the backend was clean; the whole problem was that the client *wasn't sending new photos.*
2. **The library had exceeded the client scan cap.** For performance, the client scans only the "newest N" items. Once the library grows past that cap, newer photos pushed outside the window are *invisible to the scan* — they never even make it into the hash list sent to the server.
3. **The session interrupts showed up in prod.** The frontend's **#1 ranked hypothesis (the parallel race) was confirmed verbatim.**

The hypotheses the frontend built from code alone and the conclusions the backend confirmed from prod data **met on exactly the same two branches.**

## The real cause wasn't the race

Here's the crux. The parallel race was a **real bug — but not the *user's* bug.**

- **The race was secondary** — it produced the instability the operator *felt* (occasional stalls, duplicate sessions), and the frontend fix closed it.
- **The scan-cap coverage gap was the root** — the real reason for "complete, but zero." Closing the race still leaves new photos un-uploaded.

After shipping the race fix to the operator, the report was unchanged: "new photos still don't upload." **Exactly as expected.** Closing a real bug and closing *the bug the user reported* are two different things. Both were needed.

## Part 2 — the root-cause fix, and the bug the reviewer caught

The way to close the root cause was clear. Instead of a fixed "newest N" window, **walk the whole library in chunks via a cursor** — open only one session at a time, drain it fully, then move to the next chunk. (The backend already handles hashes idempotently, so backend changes: zero.)

We wrote v1 and put it up for review. And here's the most meaningful thing that happened — **an independent LLM reviewer caught a defect (D1): this cursor isn't tie-safe.**

If the cursor key is *a single timestamp*, trouble starts **when more photos than a chunk's worth share the same instant.** A bulk import from an external messenger app, or a one-shot cloud restore, gives hundreds or thousands of photos the *same timestamp.* When that "plateau" is bigger than a chunk:

- The first chunk pulls only part of that timestamp (and *which* part is up to the native implementation).
- The next call pulls *some* part again. Unlucky, and it's the same chunk repeated.
- That hits the "zero new, buffer full" branch and *strict-advances the cursor below that timestamp.*
- **The remaining photos inside the plateau are lost forever.**

No lint, typecheck, or unit test catches this. It's invisible in the code itself — it leaned on an *unwritten assumption* that "timestamps are unique," and you only see it break by **imagining the distribution of the data.**

## v2 — remove the plateau assumption entirely

Taking the reviewer's finding, we went to v2:

- Make the cursor **compound** — not a single timestamp, but *(timestamp, a monotonic id within the collection).*
- Add a **secondary sort** to the native query so order is deterministic even within the same instant.
- Apply a **strict-less** selection so the next chunk starts *just below the previous chunk's last (time, id).*
- Images and videos use different id spaces, so the cursor can't be merged — **walk them in two phases.**

The nice property: it **guarantees forward progress regardless of plateau size.** Whether the plateau is 1,500 or 10,000, each chunk strict-less steps exactly one notch into the next region, so nothing is skipped. *The "plateau size" assumption disappears.* (And we pinned a unit test that explicitly exercises the plateau scenario.)

## Takeaways

- **Silent success is the dangerous one.** A "complete" toast plus zero uploaded. When there's no visible error, suspect first that *the input was quietly truncated* — that a window like a scan cap hid the data.
- **Closing a real bug ≠ closing the user's bug.** Separate the secondary (the instability they feel) from the root (the loss only data reveals). You need both before the report goes away.
- **Don't wait for prod data — rank hypotheses from the code — *when* the data that arrives is likely to retroactively confirm them.** Our top hypothesis showed up verbatim in the prod logs later.
- **An LLM reviewer's real value is suspecting the *unwritten* assumptions.** Lint sees types, typecheck sees signatures, tests see the *written* assumptions. A data distribution that breaks an *implicit* "timestamps are unique" is caught only by a reviewer who imagines it. Merging v1 as-is would have cost an operator build → rediscovery → another round.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
