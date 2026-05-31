---
title: "Commenting out a feature doesn't bring it back — the double-trigger race we found restoring it"
description: "An auto-sync trigger we commented out was never restored, so the feature silently died. Restoring it exposed a double-trigger race: an await between check and act defeated the re-entrancy lock."
pubDate: 2026-05-31
author: "Ascendy Engineering"
tags: ["capacitor", "concurrency", "race-condition", "incident-prevention", "vue"]
category: "frontend"
lang: "en"
translationKey: "commented-out-listeners-race"
sourceIntake:
  - "docs/intake/from-frontend/2026-05-28-commented-out-listeners-race.md"
draft: false
redactionReviewed: true
---

## TL;DR

- A report came in: auto-sync "is toggled on but nothing uploads." The cause — two re-trigger listeners had been **left commented out**.
- A working feature had been commented out as an **emergency block**, and the **restoration was missed**. The condition gate went in, but the trigger restore didn't — leaving "the gate is saved, but the trigger is dead" for a long while.
- Restoring it exposed a second bug: a **double-trigger race** — an `await` between check and act defeated the re-entrancy lock. JS is single-threaded, yet it still interleaves at `await` boundaries.

## Background — toggled on, but it doesn't run

A report said native gallery auto-sync wasn't working. The toggle was clearly on. Tracing it down, two auto-retrigger listeners had been **left commented out**:

- a listener that restarts sync on network (Wi-Fi) reconnect
- a listener that detects new media when the app returns to the foreground

The only one still alive was the cold-start trigger that runs when the app first launches. So unless Wi-Fi and new photos happened to align at launch time, auto-sync effectively never ran.

## Why it was commented out — the trace of an emergency block

Auto-sync used to work fine. But we had to **urgently block sync from starting at a certain entry point where it wasn't wanted**, and that quick block was done by commenting out the listeners. The intended follow-up was "off by default + sync only once a condition gate is on."

The condition gate did go in (both sync entry points check it). But the **trigger restore was missed**. The result: "the gate is saved, but the trigger that reads it and actually starts is dead" — for a long stretch.

## Lesson 1 — commenting out makes restoration go missing

Emergency-blocking by **commenting code out** tends to lose the restoration. A commented block drops out of the executable paths and reads as intentionally dead code in review, so it never comes back (the text still turns up in `grep`, but nothing marks it as code that *must* be restored). An emergency block is better done by:

- an **explicit feature flag**, or
- a **one-line early-return + a TODO (with an expiry condition)** — at least the trace lives in code and surfaces in search and review.

And one more thing — **the condition gate and the trigger are separate axes.** "The gate flag is saved" and "the flag is read to start the action" are different verification points. Test only the gate's storage and you'll miss the trigger-side regression.

## Lesson 2 — the double-trigger race (an await defeats the lock)

The two restored listeners both check the same global lock (`autoSyncRunning`). The problem: **there was an `await` between the check and the lock set (act)**. If the two events (app resume + Wi-Fi reconnect) fire nearly together, both pass the `if (autoSyncRunning) return` guard, then much later each sets the lock → a race that starts the same sync twice.

```ts
// BEFORE (race): the lock is set only after the dynamic import + store checks
Network.addListener('networkStatusChange', async (status) => {
  if (!status.connected || status.connectionType !== 'wifi') return;
  if (autoSyncRunning || syncCancelled) return;          // ← check
  const { useSettingsStore } = await import('~/stores/settings'); // ← await (gap!)
  // … store checks …
  autoSyncRunning = true;                                // ← act (too late)
  await startFullSync({ wifiOnly: true });
});

// AFTER (fixed): claim the lock right after the predicate, before any await; gate checks go inside try → release in finally
Network.addListener('networkStatusChange', async (status) => {
  if (!status.connected || status.connectionType !== 'wifi') return;
  if (autoSyncRunning || syncCancelled) return;
  autoSyncRunning = true;                                // ← claim synchronously, before any await
  try {
    const { useSettingsStore } = await import('~/stores/settings');
    const { useAuthStore } = await import('~/stores/auth');
    const settingsStore = useSettingsStore();
    const authStore = useAuthStore();
    if (!authStore.isLoggedIn || !settingsStore.gallerySyncEnabled) return;
    if (settingsStore.syncInProgress) return;
    await startFullSync({ wifiOnly: true });
  } catch (e) {
    console.error('[GallerySync] Wi-Fi auto sync failed:', e);
  } finally {
    autoSyncRunning = false;                             // released here even on early return
  }
});
```

The key point is that **a race happens even though JS is single-threaded.** Another callback can interleave at every `await` boundary, so if there's an `await` between the two steps of "check-then-act," that lock is useless. Claim the lock **synchronously, right after a cheap predicate and before the first `await`**; put the gate checks inside `try` so an early return still releases in `finally`.

## What's next

- Drop "emergency block = comment it out" from team convention; replace with a feature flag or an expiry TODO.
- Add re-entrancy locks that cross an `await` boundary to the review checklist as a "claim-before-await" pattern.
- When multiple listeners share one lock, put the acquisition in a **shared wrapper** instead of duplicating it per listener, to avoid drift.

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
