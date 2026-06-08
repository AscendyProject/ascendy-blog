---
title: "Making cancel-and-refund idempotent — put the terminal state transition last"
description: "Cancelling a costly async job and refunding it must survive a crash mid-way. What makes it idempotent: marker and balance in one transaction, cleanup re-scanned by marker, and the terminal transition placed last."
pubDate: 2026-06-07
author: "Ascendy Engineering"
tags: ["idempotency", "distributed-systems", "race-condition", "transactions", "reliability"]
category: "backend"
lang: "en"
translationKey: "idempotent-cancel-refund"
sourceIntake:
  - "docs/intake/from-backend/2026-06-07-idempotent-cancel-refund.md"
draft: false
redactionReviewed: true
---

## TL;DR

- When you bolt **"cancel the whole job + refund"** onto a costly async job (per-item billing + expensive external calls), the real problem isn't the happy path — it's **dying mid-crash, mid-retry.**
- Three things make it idempotent: ① **refund marker and balance increment in one transaction** (no double refund), ② **cleanup re-scans by marker every time** (no orphaned resources), ③ **the job's terminal state transition goes dead last** (so a mid-crash stays re-enterable).
- The moment a state machine has **concurrent actors (cancel endpoint vs worker)**, every transition must be a **conditional `UPDATE ... WHERE ...` + rowcount check.**
- These races (resurrection, double refund, orphans) were all caught by **adversarial plan review before implementation.**

> **Source note.** Distilled from a backend-team intake (`docs/intake/from-backend/2026-06-07-idempotent-cancel-refund.md`). Table/endpoint/pricing identifiers are generalized and billing numbers excluded. The same [adversarial review — how you call the second AI, and when to stop it](/en/blog/headless-adversarial-review-loop-en/) that caught these races worked here too.

## The happy path is easy. Dying is hard.

The requirement looked simple. A user cancels a costly batch job mid-flight (each item burns points and triggers an expensive external call) — so if it's running, stop at the next item boundary; refund the points for successes not yet finalized; clean up the temporary artifacts.

Looking only at the normal flow, it's a 30-minute job. The problem is that *every one of those steps can die.* Die mid-refund? Die mid-cleanup? The cancel request and the worker touch the same job at once? A retry comes in — who guarantees it won't refund again?

Adversarial plan review nailed three blockers in round one, and the design converged on an idempotency pattern.

## ① Resurrection race — an unconditional UPDATE revives the job

First trap. The worker claimed a job by overwriting its status to `running` **unconditionally.** But if the cancel endpoint just cancelled a `pending` job and the worker then writes `running` on top — **the cancelled job comes back to life.**

The fix is to make the transition **conditional**:

```sql
UPDATE job SET status = 'running'
WHERE id = :id AND status IN ('pending', 'queued') AND cancel_requested = false;
-- rowcount = 0 means someone cancelled first → the worker quietly backs off
```

Check `rowcount`; if 0, the worker abandons the claim. Even if the message queue delivers the job twice (at-least-once), the same condition makes the re-claim safe.

## ② Double refund — marker and balance must share one transaction

Split "refund → then change status" into **two commits**, and dying in between makes a retry refund again — returning the same success twice.

Tie the marker and the balance into **one transaction**:

```sql
BEGIN;
  -- only items not yet decided flip to 'cancelled' (rowcount confirms what actually flipped)
  UPDATE item SET decision = 'cancelled' WHERE job_id = :id AND decision IS NULL;
  -- server-side increment — not read-modify-write (concurrency-safe)
  UPDATE wallet SET points = points + :refund WHERE user_id = :uid;
COMMIT;
```

Two things matter. The marker (`decision='cancelled'`) and the balance increment are **atomic**, so a retry skips items already flipped. And the balance is bumped **inside the DB with `points + :refund`**, not read into the app and written back — safe under concurrent updates.

## ③ Orphaned resources — cleanup keys off the marker, not "undecided"

What if you crash **right after** ②'s marker commits? If cleanup is written to "delete temp artifacts only for items not yet decided," that item is already `cancelled` — so it's **excluded from cleanup forever.** The artifact orphans in external storage.

So cleanup keys off the **`decision='cancelled'` marker and re-scans the whole set every time**, not "undecided." Deleting from external storage is a no-op on a missing key, so **re-running is free** — run it any number of times, same result.

## ④ The terminal transition goes dead last

The principle that ties these together: flipping the job to `cancelled` (a terminal state) must happen **after refund and cleanup are both done.**

Why? If you die in the middle, the job stays *non-terminal*, and a re-invocation can re-enter the same teardown. The duplicate-call guard (already cancelled) must only fire **after** reaching terminal. So you **must not swallow a cleanup failure and jump to terminal** — let the failure propagate as an exception, preserving the "not done yet, come back in" signal.

Put differently, the terminal state is the **one moment of truth** that says "now it's really done." Don't leave unfinished work in front of it.

## ⑤·⑥ The other two races

- **Completion vs cancel.** There's a window where cancel arrives just after the last item is processed. So the *completion* transition is conditional too — `UPDATE ... WHERE cancel_requested = false`; if rowcount is 0, route to teardown instead of completion.
- **Mid-run cancel responds ACCEPTED.** If the endpoint tears down a running job synchronously on the spot, it races the worker and the refund. Just set a flag, respond **"accepted,"** and let the worker tear down at an item boundary and push the final total. Tune the poll interval so that "process one more item before seeing the cancel" is an affordable cost.

## Takeaways

- **Idempotency isn't "running it again gives the same result" — it's "dying at any point, a retry converges."** Every intermediate state must be a correct starting point for a retry.
- The key tool is **putting the terminal state transition last** — the terminal is the single "really done" moment, and nothing unfinished sits in front of it.
- **Concurrent actors (endpoint vs worker) → every transition is a conditional `UPDATE ... WHERE` + rowcount check.** An unconditional UPDATE is the door to resurrection and double-processing.
- A cost-reversing operation (refund) shares **one transaction with its marker**. Cleanup is **re-runnable, keyed by the marker.**
- These races are expensive to debug in production — **adversarial review before implementation** catches them far cheaper.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
