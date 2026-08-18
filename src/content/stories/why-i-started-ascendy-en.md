---
title: "I barely take photos. And I'm building a photo organizing service"
description: "I take one or two shots on a trip and almost none the rest of the year, so I never had anything to organize. This started with my wife asking twice. The first ask failed, and the second one became this."
pubDate: 2026-08-18
author: "Ascendy"
tags: ["photo-management", "family-photos", "why-i-built-this", "ai-organizing"]
category: "philosophy"
lang: "en"
translationKey: "why-i-started-ascendy"
sourceIntake:
  - "docs/intake/from-user/2026-08-18-why-i-started-ascendy.md"
draft: false
redactionReviewed: true
---

I don't enjoy taking photos. I take one or two when I go somewhere, and the rest of the
year I take almost none. So photos never piled up on me, and there was nothing to
organize. I have no memory of struggling with photo organization.

And yet here I am, building a photo organizing service.

## The person who needed it wasn't me

My wife is the opposite. Food arrives, she photographs it. She buys something, she
photographs it as a keepsake. She plans all our trips, and every piece of information and
every ticket she needs gets saved as a photo. After our baby was born, she took hundreds
of baby photos.

I take photos now too, since the baby. But I really only take baby photos. So my gallery
still has nothing to organize. Hers has baby photos and food photos and ticket photos all
mixed together.

The person who needed organizing wasn't me. It was her.

## The first ask failed

Last spring we held our child's first birthday party. When the photos came back, the baby
had been crying so hard that every shot was a grimace.

Here's the part I like: the first person she asked wasn't me. She asked GPT — just
brighten the expression a little. This was before today's image models, and what came back
was a photo where my child's face had been replaced with a different face.

So the ask came to me. Build an AI that can do simple retouching.

I tried, then gave up. Two reasons, both true. One, I'm not someone who can build an image
model himself. Two, even if I could, I judged that this is a game won by whoever has the
most data and the biggest computers.

## The second ask

So I asked her: is there anything else you need?

She said: build me an AI that organizes photos.

That one felt doable. I'm a developer, and I also wanted to try writing code by directing
an AI to do it. That's how this started.

## What I built first was useless

I kept the first version simple. Tags get attached to photos, and you search by those
tags. It worked.

But the moment a question got even slightly complex, it fell apart.

> "We took the baby on a trip this year — when was that?"
>
> "Out of the beach photos with the baby, show me only the good ones."

Tag search doesn't do that. In the end a person still had to look through the photos one
by one. I had bolted AI onto it, and the work left for the human was exactly the same. I
had gained nothing.

Looking back, that was the most important moment in this project. Giving someone one more
search box and doing the organizing for them are completely different things. The first is
easy to build, and once you've built it, nothing has changed.

## So I changed direction

I rebuilt it around what AI is actually good at. Then I fixed, one at a time, whatever my
wife said was annoying. That loop kept adding to the project. And once you're holding on
to someone else's photos, security is something you have to think about too. Building
alone, I looked up one day and I was building a photo cloud.

## Where it is now

I'm satisfied with where it is. It organizes by time, place, and person, and I find what
I'm looking for.

But I have to say this carefully. I'm someone who never had many photos to organize in the
first place. **My library is an easy problem for this service.** My wife seems to be
getting along with it too, but that's as far as it goes. So far this service has
essentially been shaped around how my wife and I use it.

People shoot different kinds of photos, and they want to sort them by different things.
Someone will want to group by person, someone else by trip, and someone else will want
receipts and documents pulled out on their own. That's not something I can figure out by
sitting here imagining it.

So what I need now is for other people to use it and tell me where it gets annoying. My
wife's complaints carried this service this far. Other people are next.

---

If you're curious, you can see it at [ascendy.ai](https://ascendy.ai). If something
annoys you while using it, tell me — that's the information I need most right now.

There's a separate piece on the same starting point from an engineering angle:
[Photo clouds solved storage, not finding](/en/blog/why-we-built-ascendy-en/).
