---
title: "All tests green — and a validator that never ran"
description: "A Pydantic validator passed six tests but never ran in production: mode='before' runs before coercion, so the value is still a string — isinstance always missed, and the tests fed datetime objects that hid it."
pubDate: 2026-06-20
author: "Ascendy Engineering"
tags: ["pydantic", "validation", "testing", "false-green", "backend"]
category: "backend"
lang: "en"
translationKey: "pydantic-before-after-false-green"
sourceIntake:
  - "docs/intake/from-backend/2026-06-20-pydantic-before-after-false-green.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We added a Pydantic validator to strip timezones, and **six unit tests passed.** That validator **never ran once in production.**
- Two layers: ① Pydantic v2's `mode="before"` runs *before* coercion, so a value arriving over HTTP JSON is still a **string** at that point → `isinstance(v, datetime)` always misses → no-op. ② **The tests passed `datetime` objects straight to the constructor**, hiding the bug.
- The fix is two lines — move the validator to `mode="after"`, and rewrite the tests with `model_validate_json()`.
- Two lessons: **`before`/`after` isn't about order, it's about the *type* of the value you receive**, and **logic that crosses the serialization boundary must be tested across that boundary** (or you get a false green).

> **Source note.** Distilled from a backend-team intake. Internal identifiers are generalized (`UploadFinalizeRequest`, `capture_time`), and Pydantic's before/after behavior is a fact you can check in the [official docs](https://docs.pydantic.dev/latest/concepts/validators/). Same *adversarial review caught it* vein as [the post where one AI reviewed another AI's PRs and caught four HIGH defects](/en/blog/redteam-adversarial-review-four-bugs-en/).

## It was a small task

Store one client-sent timestamp into a timezone-naive `DateTime` column. Clients send an offset like `Z` or `+09:00`, but the DB and every other extraction path use naive values, so that offset had to be **normalized to naive UTC.** So I attached a validator to the Pydantic field:

```python
@field_validator("capture_time", mode="before")
@classmethod
def _strip_tz(cls, v):
    if isinstance(v, datetime) and v.tzinfo is not None:
        return v.astimezone(timezone.utc).replace(tzinfo=None)
    return v
```

I wrote six unit tests. UTC `Z`, non-UTC offsets, `null`… all "verified," all green. Looked mergeable.

Then one line came back from adversarial code review — **"this validator never actually runs in production, does it?"**

## Layer 1 — `mode="before"` wasn't what I thought

`before` and `after`. By the names, it reads like an *ordering* question — before or after validation? It isn't. The real difference is **the type of the value the validator receives.**

A `mode="before"` validator runs **before Pydantic coerces the type.** So a `capture_time` arriving in an HTTP JSON body is still a **string** at that point — `"2024-05-02T03:00:00+09:00"`. But my code asked `isinstance(v, datetime)`. For a string, that's **always False.** The normalization branch is skipped, and then Pydantic parses the string into a tz-aware `datetime` that gets stored — **with the timezone never stripped.**

The validator was there. It did nothing. A silent no-op.

## Layer 2 — the tests fed a different input than production

So why were the tests green? Because they built the model like this:

```python
# bypasses the conversion path — passes a datetime object directly
req = UploadFinalizeRequest(capture_time=datetime(2024, 5, 2, 3, tzinfo=KST))
```

Pass an **already-built `datetime` object** to the constructor, and the `v` the before validator sees is a `datetime`, not a string. Now `isinstance(v, datetime)` is True — and the validator *looks like it works.*

The tests fed a **different input type** than production. Production deserializes a JSON string; the tests assembled an object by hand. Same model, different entry path. So the tests skipped *the very conversion I meant to verify* (string → parse → tz strip) and lit up green anyway. **A false green.**

## The fix — two lines

```python
# validator: mode="after". Runs after parsing, so v is always a datetime (or None).
@field_validator("capture_time", mode="after")
@classmethod
def _strip_tz(cls, v: datetime | None) -> datetime | None:
    if v is not None and v.tzinfo is not None:
        return v.astimezone(timezone.utc).replace(tzinfo=None)
    return v
```

```python
# test: same input shape as production (a JSON string).
req = UploadFinalizeRequest.model_validate_json('{"capture_time": "2024-05-02T03:00:00+09:00"}')
assert req.capture_time == datetime(2024, 5, 1, 18, 0, 0)   # naive UTC
assert req.capture_time.tzinfo is None
```

In `mode="after"`, Pydantic has already parsed the string into a `datetime`, so `v` is always a `datetime` (or `None`). The tz strip *actually* applies. And switching the tests to `model_validate_json()` makes them eat the same input shape production gets — a real JSON string.

## Takeaways

Most of the debugging time went not into *fixing the code* but into telling apart **"why do the tests run but production doesn't?"** Two things stick.

- **`before` vs `after` is about *type*, not order.** before receives the raw input (usually a string or dict); after receives the parsed, coerced type. For type normalization (tz strip, trim, range clamp) it's almost always **after**. Assume a type with `isinstance` inside a before validator and it'll quietly miss on raw input and no-op.
- **Logic that crosses the serialization boundary must be tested across that boundary.** When "string → object" conversion is part of the logic (validation, normalization, parsing), building the object straight from the constructor *bypasses that conversion* and you get green for free. Test through the **same entry path as production** — `model_validate_json()`. This goes beyond Pydantic: ORM hydration, API deserializers, message-queue parsers, all of it.
- **When tests are green but it doesn't work, suspect the input shape first.** The code may be fine; the tests may just take a different entry path than production and hide the bug. The decisive clue here was the reviewer building the model from a JSON string instead of *the way the tests did.*

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
