---
title: "CI was green and the screen was empty — three misdiagnoses a silent fallback produced"
description: "A one-line bug report cost us days. Server 200, no errors, CI green. The culprit was a fallback quietly resolving to an empty array — an absent signal doesn't just hide a bug, it manufactures wrong answers."
pubDate: 2026-08-14
author: "Ascendy Engineering"
tags: ["debugging", "api-contract", "cross-repo", "postmortem", "defensive-parsing", "testing", "incident-prevention"]
category: "frontend"
lang: "en"
translationKey: "silent-fallback-manufactures-misdiagnosis"
sourceIntake:
  - "docs/intake/from-frontend/2026-07-19-silent-fallback-manufactures-misdiagnosis.md"
draft: false
redactionReviewed: true
---

## TL;DR

- "Photos shared with a friend don't show up" — one line, and it cost days. The server returned **200**, there were no console errors, CI was green, and **only the screen was empty.**
- The real cause was a response-shape mismatch. Two buckets in the response were **plain arrays**, and the code was reading a sub-field of those arrays. Arrays have no such field, so it came back `undefined` — and **an empty-array fallback quietly turned that into zero results.**
- The point of this piece isn't *"a silent fallback hides bugs."* It goes one step further — **when there's no signal, diagnosis manufactures plausible wrong answers.**
- We went through three misdiagnoses along the way, and **two of them were real bugs.** Both were worth fixing and both got fixed. Neither had anything to do with what the user saw. *Fixing a genuine bug is exactly what created the illusion that we'd found the cause.*
- The breakthrough was **one dump of the actual response body.** Days of flailing ended the moment we looked at it.

> **About this piece.** A retrospective distilled from a frontend-team intake, on an incident that is **already fixed and shipped.** Internal endpoint paths, the real response field names, internal PR numbers, and commit references are generalized; the JSON below keeps only the *shape*, with placeholder key names. The closest sibling is [making search honest revealed the real bug](/en/blog/search-honesty-and-index-starvation-en/).

## The symptom — 200, and zero results

Opening a specific friend in the social tab should show the photos exchanged with them. Instead: "no photos to show." Same on mobile and web.

Something is already odd here. **The server returned 200, the console had no errors, and CI was green.** Nothing anywhere said "something went wrong." There was exactly one signal — *the screen is empty.*

## Three misdiagnoses — and two of them were real bugs

This is the part worth telling.

**Misdiagnosis ① "a desktop rendering problem."** We found a bug where the virtual scroller rendered at zero height inside a nested flex layout. **It was a real bug.** We fixed it. But it was desktop-only, and a follow-up report — "it's empty on mobile too" — ruled it out as the cause.

**Misdiagnosis ② "the backend has no data."** Empty on mobile too, so maybe it's the data. Backend sent it back with "the code looks correct; confirm with an actual response capture" — the right call. Layered on top of this, a **deployment lag** meant an older build was live, and the data genuinely was briefly empty. A redeploy brought the data back, and **the screen was still empty.**

**Misdiagnosis ③ "a frontend state race."** Logs showed that right after the friend's photos were set as the display source, another list request overwrote the same store — photos flashed in and vanished. **Also a real bug.** We fixed it with an ownership guard. But the operator said it wasn't flickering: **"it's empty from the start, continuously."** Wrong again.

By this point we had **fixed two genuine bugs and identified zero causes of what the user was seeing.**

This is the real cost of silent failure. The usual phrasing is "a fallback hides the bug," but what actually happened is worse. **Because the cause emitted no signal at all, diagnosis migrated toward the things that did emit signals.** The renderer had a visible defect; the store race left traces in the logs. Both got found *because they were findable.*

And the nastier part is that **those two being real bugs was itself the trap.** A false lead gets discarded quickly. Fix a genuine bug and you believe "that should be it" — and when it isn't, you move to the next plausible candidate. **A silent failure doesn't merely hide itself; it supplies substitutes to be suspected in its place.**

## The real cause — an array read as an object

The breakthrough was **one dump of the actual response body** the operator pasted in. The shape was this (placeholder key names):

```jsonc
{
  "sent":     [ /* array of media objects */ ],
  "received": [ /* array of media objects */ ],
  "sent_has_more":         true,
  "sent_next_offset":      30,
  "received_has_more":     true,
  "received_next_offset":  30
}
```

Both buckets are **plain arrays**, and the pagination metadata hangs off **suffixed keys at the top level.**

The code, meanwhile, read them like this:

```ts
const sent     = (data?.sent?.items ?? []).map(...)      // arrays have no .items
const received = (data?.received?.items ?? []).map(...)
```

`sent` is an array and the code reads `sent.items`. Arrays have no such field, so it's `undefined`, and `?? []` quietly turns that into **an empty array.**

**No exception, no type error, not one log line — and the photo count is zero.**

## How it got in — the spec existed; the deployment didn't

The history makes it plain. A commit days earlier changed the parsing:

- **Before:** buckets read **as arrays** — the shape the deployed backend actually returned
- **After:** buckets read **as objects**, reaching for a sub-field

That change was written against a backend "breaking change" spec. There was a plan to restructure the response into objects for pagination, and the frontend switched to match it.

**The problem is that a response in that shape was never actually deployed.** The frontend **hard cut over** on the strength of a PR *spec*, while the deployed backend kept returning arrays. A textbook **cross-repo contract desync.**

## Why neither CI nor review caught it

Three layers.

**① A silent fallback throws nothing.** Wrong shape, empty array, move on. Typecheck, lint, and tests all green; only the screen is blank.

**② The tests used mocks that copied the code's assumptions.** Build the mock in object form and code that reads objects passes trivially. **There was no fixture checked against a real response.** Tests in that state don't verify the code — **they verify themselves.**

**③ Single-repo static review has a ceiling.** Code review — human or cross-model — passes code that is internally consistent. Code that reads an object is not self-contradictory. This wasn't a code defect but a **runtime cross-repo contract** problem, invisible unless you hit the actually-deployed backend. CI doesn't hit it either.

## The fix — tolerant parsing instead of a hard cutover

We could have treated the deployed shape as the new "truth" and switched again. We didn't, because that's **repeating the same mistake in the opposite direction.**

Instead we made it accept **both shapes.**

```ts
// If the bucket is an array, use it; if it's an object, take its list.
const itemsOf = (bucket) =>
  Array.isArray(bucket) ? bucket : (bucket?.items ?? [])

// Prefer the top-level pagination key; fall back to the bucket's own field.
const hasMoreOf = (bucket, topLevel) =>
  topLevel ?? (Array.isArray(bucket) ? false : (bucket?.has_more ?? false))
```

And we **locked a behavioral test onto the real response shape.** If anyone hard cuts over to one shape again, that test goes red in CI. We asked the backend to settle on a single canonical response shape; until it's settled, the frontend tolerates both.

One distinction is worth drawing. **Defensive parsing and tolerant parsing are not the same thing.** `?? []` is defensive — it keeps you from blowing up. But *it doesn't say what it absorbed.* Tolerant parsing **handles the possible shapes explicitly**, and when a shape outside that list arrives, it doesn't pass quietly. In a transition period you want the latter.

## Takeaways

- **A silent failure doesn't just hide itself; it supplies substitutes to be suspected in its place.** With no signal, diagnosis migrates toward whatever does signal.
- **Having fixed a real bug is the most dangerous illusion.** "Worth fixing" and "the cause of this symptom" are different claims. Confirm with data that it explains the symptom before believing it.
- **For "nothing shows up," check the response *shape* before the renderer.** Not the status code or presence of data, but the field structure — array or object. One response body ended days of work.
- **When a mock copies the code's assumptions, the test verifies itself.** Lock fixtures to real responses.
- **A spec is not the deployed reality.** Don't hard cut over on another team's breaking-change plan; accept both shapes through the transition and clean up after confirming the deployment.
- **Separate defensive from tolerant parsing.** Not blowing up and explicitly handling the possible shapes are different jobs.

What cost us days wasn't a hard bug. It was that **nowhere was there a sentence saying we were wrong.**

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
