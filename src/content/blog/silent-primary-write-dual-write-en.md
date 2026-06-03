---
title: "The green light was lying — an ERROR right next to succeeded"
description: "A worker logged the same ERROR every run — yet the next line, the task ended succeeded. A dual-write hid the primary write's failure, and a create-guard never propagated a new schema to an existing collection."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["vector-database", "schema-migration", "observability", "debugging", "idempotency", "silent-failure"]
category: "backend"
lang: "en"
translationKey: "silent-primary-write-dual-write"
sourceIntake:
  - "docs/intake/from-backend/2026-05-31-silent-primary-write-failure-masked-by-dual-write.md"
draft: false
redactionReviewed: true
---

## TL;DR

- The worker logged the same ERROR on every task — and **the very next line, that task ended `succeeded`.** That contradiction was where everything started.
- Two nested causes. ① **A dual-write hid the failure** — there were two write paths, and the task's success verdict was tied only to the *secondary* one, so the **primary write failed every time and the light stayed green.** ② **The create-guard trap** — `if not exists: create` ignores the new schema when the collection already exists, so code and live data silently drifted apart.
- Not just writes — **reads (search) were broken** on the same field too. The fix was a one-off data operation, not a code change, and we finished by **checking read-only whether prod had the same drift** (it didn't).

> **Source note.** This post distills a backend-team intake (`docs/intake/from-backend/2026-05-31-silent-primary-write-failure-masked-by-dual-write.md`). Collection / field / module names and operational scale numbers are generalized. Its sibling in the same "silent failure" family is [ERROR was visible, only INFO vanished](/en/blog/celery-silent-info-logs-en/) — there the logs disappeared; here the **success verdict lied.**

## An ERROR next to succeeded

While looking at something else, I noticed the worker logging the same ERROR on every reindex. It was trying to write a field to the vector DB and getting rejected — "no such field on the collection, and dynamic fields are off." But something was off.

**The very next line, that task had ended `succeeded`.**

The task reports success, yet inside it a write is being rejected. That single contradiction was the clue — the success verdict wasn't reflecting what actually happened.

## Trap 1 — the dual-write hid the failure

Tracing it, there were **two** paths writing the text-search vectors. The authoritative **primary collection**, and a **secondary multi-vector collection** being rolled in (additive dual-write). The problem was where success got decided.

```python
def reindex(media_id):
    try:
        primary_upsert(media_id, ...)     # fails every time, only logs an ERROR, passes
    except Exception as e:
        logger.error("primary write failed: %s", e)
    secondary_dual_write(media_id, ...)   # if THIS succeeds, the task is succeeded
    # → metrics/status stay green, the primary quietly empties
```

The primary write caught its error in a `try/except`, **logged it and moved on**, and the task's success/failure was decided solely by the dual-write path. So the primary could fail every time and the task was always succeeded — a silent failure invisible unless you grep the logs.

Here's the irony in the design. The dual-write existed precisely to keep a failure "**from affecting the main path**." But when the direction flipped — when the masked side turned out to be the **primary** — the same safety device became a device that *hides* failures.

## Trap 2 — the create-guard is silent about schema evolution

Why was the primary write rejected? The collection-creation code looked like this.

```python
def get_collection(name: str):
    if not has_collection(name):          # ← the branch
        schema = build_current_schema()   #   never runs for an existing collection
        create(name, schema)
        create_index(name)
    return load(name)
```

`if not has_collection` looks idempotent. But there's a trap — **if the collection already exists, the schema definition is ignored entirely.** A new field had been added to the code schema months ago, but a dev collection created before that kept its old schema. A vector DB (and schema-on-write stores in general) has no implicit `ALTER` like an RDB. So **code schema and live-data schema silently drifted apart and froze that way.**

I pinned it with a measurement, not a guess. I queried the live collection schema directly.

```text
# expected: [pk, tenant_filter_field, source_text, embedding]
# actual:   [pk, source_text, embedding]   ← tenant_filter_field missing = drift confirmed
```

The field the code wanted wasn't in the live data. And the search path filtered on that same field — so **reads were broken on this collection too, not just writes.**

## The fix was data, not code

The code schema had been right all along. What was wrong was the live data that had been created and frozen earlier. So the fix was a **one-off data operation**, not a code change — drop the drifted dev collection, recreate it through the service's own creation path (same schema + index + load). The bulk reindex already running refilled the new collection, and the primary write started logging success right after (the ERROR vanished).

One step remained. **Did prod have the same drift?** If so, prod's search was broken too. So I queried the prod collection schema **read-only, once**, and compared the field set. Prod already had the field and was loaded at a normal scale — the drift was dev-only, and prod was left untouched. Not assuming "fixed in dev, so prod must be the same" — that check itself was part of the work.

## Takeaways

- **`if not exists: create` is idempotent only when the schema is fixed.** Once the schema evolves, it never reaches existing objects. Add a drift-detection guard or an explicit migration step. Schema-on-write stores have no implicit `ALTER`.
- **When you add a dual-write, make explicit which write the task's success verdict is tied to.** A "doesn't affect the main path on failure" safety device becomes a failure-hiding device if the masked direction flips.
- **"An ERROR right next to a succeeded log" is a first-order signal** that the success verdict doesn't reflect the real core work. Don't guess — query the live data directly.
- **If you fixed it in dev, check read-only whether the same drift exists in prod.** Fixing something and confirming it's safe are two different jobs.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
