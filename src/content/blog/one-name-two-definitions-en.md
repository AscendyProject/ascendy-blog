---
title: "The count wouldn't go down — when one name carries two definitions"
description: "The home card said 'N photos to clean up' and finishing the session didn't move it. The suspect was cache staleness, but the refetch already existed. Fixing that alone would have yielded a freshly fetched wrong number."
pubDate: 2026-08-15
author: "Ascendy Engineering"
tags: ["debugging", "api-contract", "ux", "postmortem", "cross-repo", "data-modeling"]
category: "frontend"
lang: "en"
translationKey: "one-name-two-definitions"
sourceIntake:
  - "docs/intake/from-frontend/2026-07-25-one-name-two-definitions.md"
draft: false
redactionReviewed: true
---

## TL;DR

- The home card said **"120 photos to clean up."** Running the cleanup session all the way through **didn't move the number at all.**
- The first suspect was **cache staleness** — "it probably doesn't refetch after you finish." Opening the code showed **the session-end handler was already refetching.** The hypothesis was wrong outright.
- The real cause had two layers. **(a)** The **same concept — "needs cleanup" — was defined differently in two code paths**, and **(b)** a long-lived native app had **a stuck snapshot.**
- Here's the point of this piece. **Had we fixed only the staleness (b), the number would have updated beautifully — to the wrong value.** It is not at all obvious that *a freshly fetched wrong number* is better than a stale one.
- The prevention is shared definitions. **The exclusion concept already existed; only the side computing the statistic wasn't consulting it.**

> **About this piece.** A retrospective distilled from a frontend-team intake. **The figures in the text are illustrative** and not the real size of any user's library. The same "fix one layer and the next appears" structure is in [making search honest revealed the real bug](/en/blog/search-honesty-and-index-starvation-en/).

## The symptom — finished, and unchanged

The product has a cleanup feature. A home-screen card tells you something like *"120 photos to clean up,"* and tapping it starts a session where you page through and choose to keep or delete each one.

The report was one line. **Run it to the end and the number on the card doesn't go down.**

## The first hypothesis was wrong outright

Cache is the first thing that comes to mind. You finish the session and the home card is still holding the old value — common, and easy to fix.

We opened the code. **The session-end handler was already refetching.**

That should have been the moment to rethink, and there's something to learn from this step. *"This is obviously a cache problem"* was **a habit, not a hypothesis.** The symptom ("a number that won't change") has the classic shape of a caching bug, so we opened the code already holding a conclusion.

## The second clue — 0 on web, 120 on mobile

The next clue changed direction. **Same account, and web showed 0 while mobile showed 120.**

Same API, same display component, two clients showing different numbers. At minimum, one of them **is holding a stale value.**

It was. The native app had a guard that fetched *once, on mount* — a common optimization borrowed from the web. But **that native app stayed alive for days**, and a value from days earlier sat there unchanged the whole time.

That was a genuine bug and we fixed it. **And fixing it still leaves the number wrong.**

## The real cause — one name, two definitions

The second layer is the substance.

The concept "needs cleanup" **existed in two code paths, with different definitions.**

**The cleanup session's queue** defined it as: photos with a low quality score or membership in a duplicate group, **excluding anything the user already marked *keep* or *later*.** Obviously — you shouldn't re-ask about a photo the user already answered "keep" to.

**The home card's count API** defined it as: the number of photos with a low quality score or membership in a duplicate group. **Full stop.** It consulted **none** of the user's decision signals.

Which produces this:

```text
The user resolves all 120 photos as "keep"

  cleanup session queue:  consults exclusions  →  0     ✅ empty
  home card count:        raw state only       →  120   ❌ unchanged
```

**The user finished the work. The queue is empty. And the card still says 120.** Tap it again and an empty session opens.

## The point — "precisely wrong"

This is what to take away.

Suppose we had fixed **only the first layer, the stuck snapshot.** The app would refetch the count on every re-entry. The number would have **updated reliably** — to **120**, every time.

The bug report said "the number doesn't change." Fix the staleness and that report closes. The screen is definitively *fresher.* But it is **not more correct.**

Is *a freshly fetched wrong value* better than a stale wrong value? I'd argue it's worse. **When a wrong value keeps updating, you lose one reason to suspect it's wrong.** "This number never changes" at least looks strange.

So for symptoms of this kind, the order matters. **First settle what the number counts, then fix when it's recounted.** Do it the other way and you close an accuracy problem as if it were a freshness problem.

## Prevention — share the definition

The part that stings is that **the shared concept already existed.**

*The exclusion list* — items the user marked keep or later — wasn't a missing abstraction. The queue was using it. Only the statistics side wasn't. There was nothing new to design; **one side simply wasn't referencing a definition that already existed.**

So the rule comes out as: **a count shown on screen must use the same definition as the work list it represents.** "120 photos to clean up" has to mean *the number of items that will actually enter the cleanup queue*, not *the number of raw candidates considered when building it.* When those differ, the screen is making a promise it can't keep.

In practice, two moves:

- Make the aggregate query and the list query **share the same predicate** — the same filter function, the same view, the same spec.
- If sharing isn't feasible right now, **pin with a test the requirement that the two agree** — across all-kept, all-deferred, mixed, and no-decisions, assert that **the count equals the queue length.** That test stays red until it's fixed, which is the point: it keeps the gap visible.

One easy mistake is worth calling out. **Don't pin "the two definitions differ" with a test.** That doesn't expose the gap, it **embalms the cause**, and the next person reads the test as intended behavior. What you pin is not the *difference* but the **requirement that they match.**

## Two side notes

**① Don't bring web instincts to a long-lived client.** "Fetch once on mount" is a habit from the web. A client that stays alive for days needs different refresh points — screen re-entry, app resume. But **we didn't add polling.** This wasn't a screen that needed a live value; it needed the *right refresh points.*

**② The completion screen filling in seconds late got fixed in the same batch.** The cause was the statistics fetch queued behind a slow sequential commit. For live-aggregate APIs, a **"fetch once immediately, then again after the commit lands"** double fetch buys both perceived speed and accuracy. Show first, quietly reconcile once it's settled.

## Takeaways

- **Settle the definition before you fix the freshness.** In the other order you manufacture *a freshly fetched wrong value*, which is harder to suspect than a stale one and can be worse.
- **A number that exists in two code paths has two definitions.** "Needs cleanup" meant different things to the queue and to the statistic.
- **A count must use the same predicate as the list it stands for.** Otherwise the screen promises something it can't deliver.
- **Often the shared concept already exists and one side just isn't using it.** Before designing something new, check whether an existing definition is being consulted everywhere.
- **Don't put "fetch once on mount" in a long-lived native app.** Refresh on re-entry and resume; polling is premature.
- **"It's a caching problem" can be a habit rather than a hypothesis.** A familiar-looking symptom doesn't mean a familiar cause.

When one symptom has two causes, the most dangerous outcome of fixing just one is **that the symptom goes away.**

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
