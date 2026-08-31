---
title: "The photo I shared today was at the very back of my friend's screen"
description: "The sort order was right — newest first. What was wrong was the definition of newest. A photo added to an album shared last month was being treated as a photo from last month."
pubDate: 2026-08-30
author: "Ascendy"
tags: ["photo-sharing", "family-photos", "product-decision", "build-in-public"]
category: "building"
lang: "en"
translationKey: "share-time-ordering"
sourceIntake:
  - "docs/intake/from-backend/2026-08-12-share-time-ordering.md"
  - "docs/intake/from-user/2026-08-29-product-surface-public-check.md"
draft: false
redactionReviewed: true
---

I saw something odd on the screen where photos are shared with a friend. **The photo I had
shared that day wasn't near the top.**

What was near the top were older shares. To reach the one I had just added, I had to scroll
a long way. I found it while using it myself.

## The sorting was working

The list is meant to show newest first, and it was doing exactly that.

What was wrong wasn't the sort. It was **the definition of newest**.

## There are two ways a photo reaches someone

One is picking a photo and sharing it directly. The other is sharing an album once and then
putting photos into it.

In the second, the album is shared once and after that photos go into that album.

The problem lived in that second path. For those photos, the time the list sorted by was
**the moment the album was shared**.

Say you shared an album last month. Today you add one photo. That photo lands in **last
month's position** in the list. You added it today and it's treated as last month's. On the
other person's screen it sits far down.

"The photo I shared today is at the very back" was exactly this.

## The definition of the moment was wrong

So the question becomes: **when does a person feel a photo was shared?**

Not when the album was shared. That was weeks ago. The event a user experiences is **the
moment this photo became visible to that person**.

That narrows the answer to one thing: of the time the album was shared and the time the
photo was added to it, whichever is **later**. That's when the event happened for the
person.

That's the whole change. The sorting stayed as it was; only which timestamp it lines up by
changed.

## One more — photos appearing twice while scrolling

Something else got fixed alongside it.

Scrolling the list loads the next photos in. But if the only thing deciding order is a
timestamp, photos sharing the same timestamp have no defined order among themselves. They
can trade places between loads.

At a page boundary that means some photos show up twice and others never show up at all. It
looks like a photo went missing, when really the order underneath was shifting.

Adding a second tiebreaker for when timestamps match keeps photos sharing a timestamp from
trading places between loads.

## Where it is now

The photo added today lands in today's position.

What this left isn't the fix. It's the test: **when you decide the order of a list, is that
timestamp the same event the user experiences?**

The timestamps a system finds easy to record and the ones a user experiences as events can
differ. The day an album was shared is recorded, but it isn't experienced as an event.
Adding a photo today is. That second one is what a screen should line up by.

---

[Ascendy](https://ascendy.ai) is for sharing photos with family and friends. Share an album
once and after that you only add photos. It runs in the browser; the signup screen asks for
an email and a password, and the pricing page has a free plan. There's no app yet.

If you run into something like this, tell me. This one turned up because I was using it, and
the next one probably will too.

Why I started building this is a separate piece:
[I barely take photos](/en/stories/why-i-started-ascendy-en/).
