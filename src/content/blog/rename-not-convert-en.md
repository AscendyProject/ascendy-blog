---
title: "I believed it converted, but it only renamed — and the failed jobs vanished from the list"
description: "A bulk photo edit failed wholesale with no error UI. One path renamed HEIC to .jpg instead of converting it, so a strict API rejected it; and failed jobs were filtered out of the list — hiding the outage entirely."
pubDate: 2026-06-04
author: "Ascendy Engineering"
tags: ["image-processing", "heic", "silent-failure", "error-contract", "debugging"]
category: "backend"
lang: "en"
translationKey: "rename-not-convert"
sourceIntake:
  - "docs/intake/from-backend/2026-06-04-rename-not-convert.md"
draft: false
redactionReviewed: true
---

## TL;DR

- A bulk photo edit was **failing wholesale**, yet the user got **no toast, no error UI.** A progress card flashed up and quietly disappeared.
- Two faults stacked. ① One edit path sent HEIC **without converting it — it only renamed the file to `.jpg`** — so a strict external API rejected it by magic bytes. ② Failed jobs were **filtered out of the list query**, so the failure was invisible to the user.
- Lessons: **slapping a `.jpg` name on a file is not a conversion.** And **hiding a failure is usually the second bug** — the code that *creates* a failure and the code that *masks* it live in different files.

> **Source note.** Distilled from a backend-team intake (`docs/intake/from-backend/2026-06-04-rename-not-convert.md`). The external image API's vendor, endpoint, and internal error codes are generalized (HEIC, EXIF, `pillow-heif` are public tech, kept as-is). Same "silent failure" family as [a silent log that pointed at a non-existent model](/en/blog/celery-silent-info-logs-en/), [placeholder defaults masking a config failure](/en/blog/placeholder-defaults-mask-config-en/), and [a dual write masking a failed primary write](/en/blog/silent-primary-write-dual-write-en/).

## The quietly vanishing card

The report came from the frontend: bulk photo editing is wholly broken. But the symptom was strange.

You start it, a progress card flashes up, and a few seconds later it's gone. Refresh, and it never comes back. **No toast, no error message, no red X.** From the user's side, "I clearly clicked it and nothing happened."

The DB told a different story. Recent jobs were **all `failed`**, each item stamped with an `invalid image file`-style 400 from the external image API. The job was failing loudly — that failure just never reached the screen.

There were two faults, and they lived in different files.

## Fault ① — the "conversion" was a rename

One edit path was sending the original image bytes straight to the external API, setting only the file object's name:

```python
file.name = "input.jpg"   # bytes unchanged, just a JPEG label
```

That's the trap. **Putting a `.jpg` name on a file object is a hint to the decoder, not a content conversion.** When HEIC — the iPhone default — comes in, the content is still HEIC. And a strict external image API checks the real format by **magic bytes**, not by extension or name. The disguise doesn't work → `invalid image file`.

The cruel part: the *other* edit engines in the same codebase were fine. They ran a decode→re-encode normalization before sending. **Only this one path skipped it.** Add a new backend "because it's similar" without sharing the common preprocessing, and one path silently diverges like this.

One more twist. The HEIC decoder library (`pillow-heif`) was **already installed** in dependencies. But there was no register call anywhere — installed but never invoked, **dead code.** "The package is installed, so it works" is no guarantee.

## Fault ② — failed jobs disappeared from the list

Fault ① alone was bad. But the truly nasty one was the second.

The query fetching the review-pending list filtered like this:

```sql
SELECT ... FROM job WHERE status IN ('running', 'completed');
```

`failed` is missing. So the instant a job dropped to failed, it **vanished from the list** — that's why the card evaporated. The detail API returned failed jobs just fine, but the *list* the user sees first hid them. **There was no surface on which to see the failure.**

That's the core shape of a silent failure. Fault ① *creates* the failure; fault ② *hides* it. And the two usually live in **different files, different people's heads.** Fix ① and leave ②, and the next failure vanishes just as quietly.

## The fix — three strands

1. **Pre-flight normalization.** Always normalize right before the external call — register the HEIC decoder + decode + **EXIF orientation** (`exif_transpose` — skip it and iPhone portrait photos go out lying on their side, metadata stripped) + RGB convert + downscale the long edge + re-encode to JPEG under the size cap.
2. **A structured error contract.** Replace the external provider's raw dump with a **structured code** the client can branch on (unsupported format / too large / corrupt / generic engine error).
3. **Make failure visible.** Widen the list query to **include failed jobs from the last 24 hours**, so a failure card can show.

Review caught the missing **EXIF orientation** in (1) in round one — confirming two other paths in the codebase already used `exif_transpose`, we agreed and fixed it, and it passed round two.

## Takeaways

- **Slapping a `.jpg` name on a file is not a conversion.** A strict API reads the real format by magic bytes. Actually decode→re-encode before sending.
- **Share common preprocessing across a feature's multiple engines.** If one path skips normalization, that's the one that quietly breaks.
- **Hiding a failure is often the second bug.** The code that creates a failure and the code that masks it live in different files. Design the error contract (structured codes + a window that keeps failures in the list) up front, so a "silent outage" becomes a "visible failure."
- **A library being installed ≠ working.** Check that the register/init call is actually on the code path.
- Apply **EXIF orientation first** when re-encoding, or portrait photos lie down (`exif_transpose`).

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
