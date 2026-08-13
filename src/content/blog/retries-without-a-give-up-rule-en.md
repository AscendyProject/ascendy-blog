---
title: "Retries, but no rule for giving up — the infinite loop four files made"
description: "Monitoring flagged hundreds of processing failures. The culprits were four corrupted files. The hard timeout, the zombie reaper, and the requeue were each individually right — and nobody counted the attempts."
pubDate: 2026-08-13
author: "Ascendy Engineering"
tags: ["celery", "retry", "dead-letter", "concurrency", "postmortem", "reliability", "queue"]
category: "backend"
lang: "en"
translationKey: "retries-without-a-give-up-rule"
sourceIntake:
  - "docs/intake/from-backend/2026-08-11-retry-without-give-up-rule.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Periodic monitoring flagged **hundreds** of media-processing failures. Tracing them down, the culprits were **four corrupted files.** They were burning worker slots and papering over the failure metric, which **buried the real incident signals.**
- The loop ran like this: a corrupted file drags the pipeline to the hard timeout → SIGKILL → the zombie reaper sees a "stuck job" and resets it to pending → requeue → hangs again → repeat.
- The nasty part is that **all three components were individually correct.** The hard timeout prevents hangs, the reaper recovers from worker death, the requeue prevents loss. The problem was that the three formed a loop and **nobody counted the attempts** — *the retry machinery existed; a rule for giving up did not.*
- It's not that no cap existed. A **later step** in the pipeline had one. But the hang happened at an **earlier stage**, so execution **never reached** that cap.
- So the cap has to be enforced at the **execution boundary**, not on the enqueue side. And because **SIGKILL doesn't run `finally`**, the attempt counter has to be committed durably **at the moment the job is claimed**, not after it finishes.

> **About this piece.** A postmortem distilled from a backend-team intake. Absolute figures that would pin down scale, internal task and column names, and the real constants for the timeout and the cap are generalized. It connects to [the deploy that deployed nothing](/en/blog/deploy-that-deployed-nothing-en/), where a safety net passed vacuously, and to [a periodic report is only worth it when the loop is closed](/en/blog/monitoring-closed-loop-route-en/) — the monitoring that actually caught this.

## Hundreds of failures, four files

The periodic monitoring report showed hundreds of media-processing failures. On the number alone, the whole pipeline looks like it's shaking.

Tracing it, the noise came from **four distinct files.** A handful of corrupted media were repeating the same failure endlessly and filling the metric.

The damage ran two ways. One was **worker slots** — those files held processing slots and sat there until the timeout while other work queued behind them. The other is worse: **the failure metric got papered over, and real incident signals were buried in it.** When hundreds of failures are the daily normal, the one real failure mixed in is invisible.

## The shape of the loop — all three parts were individually right

The pipeline had these mechanisms:

1. **A hard timeout** — force-terminate a job after a set time so it can't hang forever.
2. **A zombie reaper** — periodically find jobs that will never finish because their worker died, and return them to pending.
3. **A requeue** — put jobs that returned to pending back on the queue.

All three are **individually unobjectionable.** Without the hard timeout, a worker hangs forever. Without the reaper, jobs evaporate when a worker dies. Without the requeue, transient faults lose work.

Now feed in one corrupted file:

```text
decode attempt → no progress → hard timeout → SIGKILL
   ↓
zombie reaper: "this job is stuck" → reset to pending
   ↓
requeue → decode attempt → no progress → hard timeout → SIGKILL
   ↓
  (forever)
```

Each part did its job exactly right, and together they became a **perpetual motion machine.** No component misbehaved — **nobody was counting which attempt this was.**

## The retry machinery existed; the give-up rule didn't

This is the incident in one sentence. **Retries were carefully implemented. Giving up was not implemented at all.**

When we write retry logic, we focus on *how* to try again — backoff, jitter, queue separation, priority. But half of retry design is **"when do we stop,"** and that half gets forgotten. Without a stopping condition, a retry isn't a recovery mechanism; it's an **amplifier.**

What makes it more interesting is that a cap *did* exist. A **later step** in the pipeline had an attempt cap, added after an earlier cost incident. But this hang occurred at an **earlier stage.** Dying up front, it **never once reached** the cap further down.

*A defense exists, and execution never reaches the point where the defense lives* — that's the exact shape of [the deploy safety net that passed vacuously](/en/blog/deploy-that-deployed-nothing-en/). Don't count your defenses; check whether they sit **on the path execution actually takes.**

## Enforce the cap at the execution boundary

So where should the cap live? Intuitively the enqueue side is easier — have the scanner filter out "items past their attempt count" before queueing.

But that gets **bypassed.** The requeue path isn't just one scanner. There's the reaper reviving jobs, manual reprocessing, another service enqueueing directly. With multiple entrances you need a filter at each one, and missing a single entrance keeps the loop alive.

So the cap belongs at the **execution boundary** — the point where a worker picks the job up. Inside the atomic UPDATE that claims the job, **increment the attempt counter and check the cap together.**

```sql
-- Conceptual shape: claim, count, and cap check, atomic in one statement.
UPDATE jobs
   SET status   = 'processing',
       attempts = attempts + 1
 WHERE id       = :id
   AND status   = 'pending'
   AND attempts < :cap          -- the real circuit breaker
RETURNING id;
```

The virtue of this shape is that **the number of entrances stops mattering.** However a job got queued, it has to pass through this statement to run, and an item past the cap simply fails to claim.

## SIGKILL doesn't run `finally`

The second subtle point: **when** you write the counter.

The natural implementation writes it after the job finishes, along with the result — completed on success, failed plus an incremented attempt count on failure. Put it in a `try/finally` and it feels safe against exceptions.

**The hard timeout arrives as SIGKILL.** And SIGKILL does not run `finally`. The process simply ceases. So "increment after finishing" fails to run **precisely in this incident's situation.** A job that dies every time never increments, and stays on its first attempt forever.

Which is why the counter must be written **at the moment the job is claimed, already committed.** The claim UPDATE above is that place. It looks pessimistic — it counts attempts that started but never finished — but it's **the only point that survives a kill.**

## Changing the status isn't a dead letter

Third. It's tempting to think "fine, past the cap we set it to `failed`."

But what if the scanner treats `failed` items as eligible for reprocessing? An item whose status merely changed gets queued again on the next sweep. **A status transition is a label, not a circuit breaker.**

The real breaker is **the counter and the predicate that reads it.** Leave status as the human-readable label, and let `attempts < cap` be what actually cuts the loop. Done this way, the loop stays dead without touching the scanner and even when a new enqueue path appears.

## Three concurrency traps the review caught

The fix looks simple, but implementing it walked into **three concurrency traps.** All three were caught by adversarial code review from a model of a different family.

**① A subquery shared by two UPDATEs leaks twice the budget.** Define "the items to process this batch" as a subquery and reference it from two UPDATE statements, and **the subquery is re-evaluated in each one.** The set it resolves to the second time can differ from the first, so more items get processed than intended. **Materialize the cohort first** and work from that fixed list.

**② select-then-update double-processes.** Split it into "select matching rows" then "update what you selected," and the reaper runs once more in between and picks up the same items. Fold selection and update into one statement with **a conditional UPDATE plus RETURNING.**

**③ Read-verify-write overwrites what happened in between.** If another transaction changes the row between your read and your write, your write silently clobbers it. Use **compare-and-swap** — write only if the value you read is still there.

One thing runs through all three. **If there's time between "checking" and "acting," the world changes in that gap.** Either fold the two into a single statement, or re-verify at write time that what you saw still holds.

## Make the fix terminate itself

One last note on rollout. A fix like this raises "and what about the problem items already piled up?" One option is an operator running a cleanup script.

We didn't do that. Instead we designed it so that **deploying alone lets the problem items reach the cap and stop by themselves.** A corrupted file increments on its next attempt, goes around a few more times, fails to claim at the cap, and stops.

**Operator intervention is zero.** A cleanup script is its own dangerous object (write it wrong and it touches healthy items too) and it adds one more thing a human has to remember to run. When you can make a fix clean up after itself on deploy, that's the better shape.

## Takeaways

- **Half of retry design is "when do we stop."** A retry without a give-up rule isn't a recovery mechanism, it's an amplifier.
- **Individually correct parts compose into loops.** Timeout, reaper, and requeue were all right; nobody was counting. Look at the **cycle the parts form**, not the parts.
- **Cap at the execution boundary, not at enqueue.** There are many entrances, and per-entrance filters miss one. Increment and check inside the atomic claim UPDATE.
- **SIGKILL doesn't run `finally`.** Commit the counter **when the job is picked up**, not after it finishes, or it won't survive the kill.
- **A status transition is not a circuit breaker.** Relabel it and the scanner picks it up again. The counter and predicate are what cut the loop.
- **Leave no time between "check" and "act."** Conditional UPDATE + RETURNING, materialized cohorts, compare-and-swap.
- **Let the fix clean up after itself.** If deploying alone drives problem items into the cap, operator intervention is zero.

Sometimes it matters less how many safety mechanisms you have than **what those mechanisms are building with each other.**

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
