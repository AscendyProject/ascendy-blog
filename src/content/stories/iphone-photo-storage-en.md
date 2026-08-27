---
title: "I deleted a hundred photos and my iPhone storage didn't move"
description: "You delete a hundred photos and the number barely changes. There are usually two reasons, and each takes about thirty seconds to check. Then there's the pile that's left at the end."
pubDate: 2026-08-28
author: "Ascendy"
tags: ["photo-management", "iphone", "storage", "family-photos"]
category: "guides"
lang: "en"
translationKey: "iphone-photo-storage"
sourceIntake:
  - "docs/intake/from-user/2026-08-18-why-i-started-ascendy.md"
draft: false
redactionReviewed: true
---

"iPhone Storage Almost Full."

The notification shows up, so you open Photos and go looking for things to delete. A few
screenshots, a few blurry shots, two of the three you took from the same angle. You get rid
of a hundred, go back into Settings, and the number is basically where it was.

You gave up the photos and you don't even know what you did wrong.

Usually you didn't do anything wrong. The iPhone deletes photos in two steps, and you did
the first one.

Everything below is on iOS 26. Screen names shift a little between versions.

## Deleted photos stay for 30 days

A photo you delete in Photos doesn't disappear. It moves to **Recently Deleted** and stays
there for 30 days. That's the safety net for accidental deletions — and for those 30 days,
those photos **still take up the space.**

Open Photos, tap **Collections**, scroll down to **Utilities**, and you'll find **Recently
Deleted**. Empty it and the space actually comes back. If you use iCloud Photos, your
iCloud storage drops too.

There's no undo past this point, so it's worth one look before you empty it.

## Before you delete — if iCloud Photos is on

You want to know this part first.

With iCloud Photos on, a photo you delete on one device is **deleted on every device**
signed in to the same account. It's gone from the iPad and the Mac too. "Delete it off my
phone but keep it in iCloud" isn't a thing in this state.

The good news is that the same 30 days applies here. If you haven't emptied Recently
Deleted, you can still get it back.

When you're clearing out photos that only exist once — baby photos, old family photos —
hold both of those sentences at the same time.

## The original may not be on your phone at all

This is the second reason, and it's the less familiar one.

In Settings, tap your name at the top, go to **iCloud → Photos**, and you'll find
**Optimize iPhone Storage** (on some versions it sits under Settings → Photos). When it's
on, the originals live in iCloud and your phone keeps small copies.

So in this state you can delete a hundred photos and free up far less phone storage than you
expected, because what left the phone was the small copy.

**That does not mean the original survives.** Deleting a photo deletes the original in iCloud
too. Once Recently Deleted is emptied, or 30 days pass, the full-resolution original is gone
as well. "I only deleted it to free up my phone, so the original must still be there" isn't
how it works.

One more thing: **turning Optimize iPhone Storage on doesn't reduce your iCloud storage.**
The originals are still sitting in iCloud. Phone storage and iCloud storage are two separate
buckets, and the first step is working out which one the warning is
about. Phone: Settings → General → **iPhone Storage**. iCloud: Settings → your name →
**iCloud**.

And turning the option on now won't free space immediately. The iPhone swaps originals out
**when it needs the room.**

## The big things usually aren't photos

If you've checked both of those and you're still short, it's time to change what you're
deleting.

One photo and one minute of video aren't the same order of magnitude. Starting with photos
costs a lot of attention and returns very little space. Most of the time the large files
are videos.

Open Settings → General → **iPhone Storage** and look at the **Recommendations** at the
top. If you see one about reviewing videos (Review Personal Videos), tap it — your videos
come back sorted by size. That recommendation only appears once you're past a certain
amount of video, so don't worry if it isn't there. In that case go to Photos →
**Collections → Media Types → Videos** and start with the long ones.

## Start with what needs no judgment

Deleting is hard because of the judgment, not the storage. So start where there's no
judgment to make.

**Collections → Utilities → Duplicates.** The duplicates Photos has found collect here —
photos you ended up saving twice, sent to you twice, or copied over from another device. Tap
Merge and the best-quality version stays while the rest go to Recently Deleted.

This is the easy stretch. It's the same photo, so there's nothing to decide.

## And what's left at the end

Do all of that and the number usually drops noticeably.

And then it stops.

What's left is the photos that are **similar but not the same**. The ten you fired off
because you were afraid of missing the moment the baby smiled. The five from the same spot
at slightly different angles. Those never show up under Duplicates — they're different
photos. That's the right behavior. Which one is better isn't written anywhere in the file.

So a person does this part. You open all ten, drop the one with closed eyes, drop the blurry
one, and sit with the three that are left. And then you usually just close the app. The
judgment lands on exactly the photos you least want to delete.

## In order

| Symptom | What to check | Where |
|---|---|---|
| Deleted, nothing changed | Whether Recently Deleted is empty | Collections → Utilities → Recently Deleted |
| Freed less than expected | Whether Optimize iPhone Storage is on | Settings → your name → iCloud → Photos |
| Not sure which is full | Phone vs iCloud, separately | Settings → General → iPhone Storage / Settings → your name → iCloud |
| Nothing left to delete | Videos first | Recommendations in Settings → General → iPhone Storage |
| Want space without deciding | Merge duplicates | Collections → Utilities → Duplicates |

---

That usually clears "iPhone Storage Almost Full." The row I keep getting stuck on is the
last one.

The first thing I built for this service tagged photos so you could search the tags. It
worked, and it fell apart on requests like "just show me the ones that came out well." A
person still had to look at every photo. I wrote about that
[separately](/en/stories/why-i-started-ascendy-en/).

That's the part I'm holding onto while building [Ascendy](https://ascendy.ai) — how much of
the judgment you make in front of ten near-identical photos can be done for you. It isn't
all there yet.

If finding is your problem rather than space, this one fits better:
[Finding a photo from three years ago on your iPhone](/en/stories/find-old-photos-iphone-en/).
