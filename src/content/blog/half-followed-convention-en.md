---
title: "The component vanished only in production — the cost of half-following a convention"
description: "An invite QR rendered as a blank white box in production only. The culprit was the component auto-import naming rule — in a repo that mostly used explicit imports and had therefore never verified it."
pubDate: 2026-08-15
author: "Ascendy Engineering"
tags: ["nuxt", "vue", "debugging", "auto-import", "production-only-bug", "postmortem", "bundle-analysis"]
category: "frontend"
lang: "en"
translationKey: "half-followed-convention"
sourceIntake:
  - "docs/intake/from-frontend/2026-07-24-half-followed-convention.md"
draft: false
redactionReviewed: true
---

## TL;DR

- An invite QR code rendered as a **blank white box in production only.** Not an error, not an empty page — a box that took up its space with nothing inside it.
- The culprit was neither the QR library nor the security patch that had just landed. It was the **component auto-import naming rule.** Components under a particular directory get registered with **the directory name prefixed**, while several templates used **the bare filename** as a tag with no explicit import.
- So the build couldn't resolve that tag to a static import and **left it as a runtime lookup**, which in production rendered as an unresolved custom element — **silently.**
- The diagnosis came from **the bundle**, not the symptom. Grepping the build output for **a string unique to the QR library** found it nowhere in the client bundle — with no importer, the whole library had been tree-shaken away.
- But the point of this piece isn't that rule. **This repo mostly followed an explicit-import convention. Which is exactly why nobody had ever verified how auto-import actually registers names.** Half-follow a convention and **the half you don't use stays unverified.**

> **About this piece.** A retrospective distilled from a frontend-team intake; every defect mentioned has been fixed and shipped. A neighboring case from the same team is [three misdiagnoses a silent fallback produced](/en/blog/silent-fallback-manufactures-misdiagnosis-en/) — though its thesis (an absent signal supplies misdiagnoses) is different from this one's (the unused half of a convention stays unverified).

## The symptom — not an error, not an empty page

The invite screen should show a QR code. It showed **a blank white box.** In production only.

That shape — "blank white box" — tells you a lot about the character of this bug. An error screen has a stack. Nothing rendering at all collapses the layout and gets noticed. But when **the space is occupied exactly and only the contents are missing**, it reads as *the component rendered and its insides came up empty.* So suspicion naturally moves to **the logic that fills the inside.**

## The plausible misdiagnosis

A patch had just landed that changed how QR codes were generated — moving from an external service to **local generation**, as a security improvement.

The timing lined up perfectly. QR stopped appearing after that patch. So **that patch broke something** is the most reasonable inference available. That was the operator's first hypothesis, and I'd have started there too.

One more thing compounded it. The QR component contained a **silent catch** for generation failures — on failure it leaves the image data as an empty string and moves on. The existence of that code **completes** the story: *"the library failed in production, the catch swallowed it, hence the blank box."* The more you read the code, the more right that hypothesis looks.

## Look at the bundle

The breakthrough wasn't digging further into the symptom. It was **reading the build output.**

First, in dev, we imported the QR library directly and generated a code. **It worked.** The library hypothesis wobbled once here.

Then the decisive step. Build for production, and grep the entire client bundle for **an error string unique to the QR library**.

```bash
npm run build
grep -r "too big to be stored in a QR Code" dist/    # a string only that library has
# → no results
```

**The library wasn't in the bundle at all.**

That single line inverts the hypothesis. Not "the library failed in production" but **"the library doesn't exist in production."** There was no code there to fail.

Which changes the question to: *why did the bundler drop it?* Only one answer — **because nothing imported it.** Tree-shaking did its job exactly right.

A lesson to take from this. **"It only breaks in production" is not a runtime-debugging problem.** When an environment difference is the cause, that difference usually lives in *the build*, and grepping the build output is the fastest route to the truth. And **a library's unique strings make good markers** — unlike versions or paths, bundlers don't rewrite them.

## The real cause — the name was different

Following the compiled output of the call site:

```js
// Not replaced by a static import; left as a lookup by name at runtime
const N = resolveComponent("QrCodeImage")
```

We checked the auto-import registry. The component was registered not as `QrCodeImage` but as **`CommonQrCodeImage`.**

The rule: **the name of the directory containing the component is prefixed to its registered name.** `QrCodeImage.vue` under `common/` becomes `CommonQrCodeImage`. The templates, meanwhile, wrote `<QrCodeImage>` with no explicit import. No such name is registered.

An unresolved name renders as **an unresolved custom element.** Browsers don't error on unknown tags — they treat them as inline elements and move on. Hence **a blank white box.**

This also explains why the trap lived in only one directory. Components whose filenames already start with their directory name (say `mobile/MobileXxx.vue`) get **the duplication collapsed** and register as `MobileXxx`. So bare tags there happened to be correct. **Only `common/` was mined.**

## The point — the cost of half-following a convention

Here's the substance.

This repo mostly followed **an explicit-import convention.** Use a component, write an `import` at the top. A good convention, and most files honored it.

The problem is that **auto-import was never turned off.** So the repo's actual state wasn't "we use explicit imports" but **"we mostly use explicit imports, and a few places depend on auto-import."** And **nobody was aware of those few places.**

Which produces the crux. **Because auto-import was barely used, nobody had ever checked how it actually registers names.** Had it been a daily-use feature, someone would have hit the prefix rule in the first week and it would have become team knowledge. Because it was barely used, **it stayed wrong for months.**

That's the danger of a half-followed convention. When two approaches coexist, **the less-used one is the more dangerous one** — because verification comes from usage. Heavily used paths get walked every day and are verified as a side effect; lightly used paths **never get walked, so nobody learns they're wrong.**

So there are two acceptable states. **Follow the convention completely (turn auto-import off), or acknowledge that both mechanisms coexist and explicitly verify the one you use less.** The worst state is the one we were in: **believing "we use explicit imports" while a few places don't.**

## The siblings the sweep found

Once you know the cause, the same pattern is mechanically findable. We ran a script comparing every bare tag usage against explicit imports.

**Two more turned up.** One was an error alert on the signup page; the other was a consent dialog — **silently not rendering in production, by the same pattern.** Like the QR, nobody had reported either. Things that don't appear *don't raise errors.*

Each fix was **one explicit import line.** Days to find the cause, three lines to fix. That ratio is typical for this class of bug.

We added a defensive layer too: the QR component's **silent catch became a log plus an error emit**, and on failure it now falls back to **showing the referral code as text.** If the QR doesn't render, the user can still do the thing.

The follow-up is **a static scan in CI that catches bare component usage** — moving from people remembering a convention to a machine catching the deviation.

## Takeaways

- **Half-follow a convention and the half you don't use stays unverified.** When two mechanisms coexist, **the less-used one is more dangerous** — verification comes from usage.
- **Check "we use X" against what the repo actually does.** This repo believed it used explicit imports while a few places relied on auto-import.
- **"It only breaks in production" means look at the bundle.** The environment difference usually lives in the build, and grepping the output is the fastest truth. **A library's unique strings make good markers.**
- **Distinguish "it failed" from "it isn't there."** Finding the library absent from the bundle demolished the "the library broke" hypothesis in one step.
- **Once you know the cause, sweep for the pattern mechanically.** One report led to two more, one of them heavier than the original.
- **Move conventions people remember into rules CI checks.** A convention stops being one the moment it's only half-followed.

The most dangerous code isn't code that's wrong. It's **code nobody has ever checked for being wrong.**

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
