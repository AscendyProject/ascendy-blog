---
title: "Everything you can click should also be sayable — yet enabling it started with a menu"
description: "I asked an AI agent to recall my past conversations. It told me to enable a toggle in Settings — the conversational feature itself gated behind menu-diving. The industry proved parity works, then stopped halfway."
pubDate: 2026-06-06
author: "Ascendy Engineering"
tags: ["ai-agent", "ux", "conversational-ui", "product-design", "opinion"]
category: "meta"
lang: "en"
translationKey: "conversational-parity"
sourceIntake:
  - "docs/intake/from-user/2026-06-06-conversational-parity.md"
draft: false
redactionReviewed: true
---

## TL;DR

- **Our claim (an opinion)**: *every* action you can do by clicking a menu or button should *also* be doable by telling the agent in conversation — **conversational parity**. Not "kill the menus," but: every click-action must have a conversational path *alongside* it.
- **A fact, as of 2026**: Claude, ChatGPT, and Gemini all let you *recall past conversations* conversationally now. The industry **proved** parity works.
- **But it stopped halfway**: to *enable* that recall feature, you still have to dive into a Settings menu and flip a toggle. The conversational feature's **entry point is itself non-conversational.** Help, settings, sharing, export — still click-only.
- **There's a principled exception**: irreversible *public / privacy* actions should stay behind a human click on purpose. Parity isn't dogma.

> **Source note.** This isn't a decision record or an incident write-up — it's an **argument piece written from an operator interview** (this blog's first "industry argument" genre). First-person opinion is marked as opinion, external facts are attributed, and current product status was fact-checked at publish time (refined-source path in frontmatter `sourceIntake`). The feedback thread connects to [a report arriving changes nothing](/en/blog/monitoring-closed-loop-route-en/)'s capture→route, and the product motivation to [why we built Ascendy](/en/blog/why-we-built-ascendy-en/).

## "Pull up my past conversations" — "Enable it in Settings"

Start with one scene. June 2026, I opened an AI agent session on the web and asked: "Can you pull up my past conversations?"

The gist of the answer: full-text search of past conversations is **off by default** in this session, and to use it I'd have to go to **Settings → Profile and turn on the "Search and reference past chats" toggle.**

I paused there. I'm trying to recall the past *through conversation* — and to do that, I have to **leave the conversation, dig through a menu, and flip a switch.** *Saying* "turn that feature on" doesn't work. **The conversational feature's entry point is itself non-conversational.**

That small irony is the whole article.

## The claim — conversational parity

Here's our opinion. **Every action you can do by clicking a menu or button should also be doable by telling the agent in conversation.** The chat window is already a good-enough interface, yet the work *around* it isn't seamless from inside it.

Let's preempt the misread. This is not "remove the menus." People used to the old UX may genuinely find conversation more awkward — we don't deny that. Keep the menus. Let outputs render as buttons, cards, links. The point is one thing: **every click-action must have a conversational path *alongside* it.** Both entry points open — call it **conversational parity.**

This stance doesn't actually conflict with what UX designers say publicly. It converges. Designers argue that "**chat isn't always the right answer — pure conversational UI is cognitively demanding and hard to navigate; a hybrid (chat + buttons/cards) is best**" ([UX Collective](https://uxdesign.cc/where-should-ai-sit-in-your-ui-1710a258390e), [Design Key](https://www.designkey.studio/post/conversational-chat-agent-ui-design)). True. And conversational parity is a *stricter version* of that hybrid view — doing the hybrid *right* means laying a conversational path over *all* the clickable actions, not just *some*.

## The industry already proved parity works

Here we have to be honest. "AI agents still make you click for everything" is *false as a current fact.* As of 2026, all three let you *recall past conversations* by talking:

- **Claude** — chat search + memory (free for all users since 2026-03-02). Say "find what I discussed before" and it calls a search tool to pull it together ([Claude Help](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context)).
- **ChatGPT** — past-chat search + Memory Sources (2026-05, shows referenced sources).
- **Gemini** — recalls past chats ("no need to hunt for a thread," though less precise) ([Google](https://blog.google/feed/gemini-referencing-past-chats/)).

This doesn't *weaken* the claim. It *strengthens* it. **The industry took one of the most common click-actions — finding a past conversation — and made it conversational, proving conversational parity actually works.** The problem is it stopped there.

## The half-built parity

Recall went conversational — yet *enabling* that recall is still a menu toggle. Help is still a separate page click. Settings, sharing, export are mostly click-only. Even recall: sidebar search matches *titles* only, not content (Claude). Conversational recall hides as a *secondary* feature while the list stays the primary path.

So parity **stopped halfway.** One feature got pulled into conversation, while the equally-clickable features right next to it were left in their old spots.

## Why it stopped there (our guess)

This is a guess, not an assertion — honestly, we're more curious what actual designers think. Still, it's probably layered:

1. **It was rational at first.** Early agents couldn't reliably turn "say it" into "do it." So a definite click-menu was the right design.
2. **The UX hardened around that capability.** One product succeeded, and everyone copied its shape.
3. **Users adapted.** "LLM services just look and work like this" accumulated as lived experience.

The result is the familiar pattern — **the constraint that justified the shape (limited agent capability) eased, but the shape stayed on by inertia.** It's a shape we've seen in other posts too: a structure that outlives the reason for it.

## What we do (and where we stop)

Just lecturing others is weak. We (Ascendy) actually apply this parity in the product — **most click-doable features that operate privately are also doable in natural language.**

But there's one **principled exception.** Actions that are *irreversible and privacy-sensitive* — like making a photo *public* — are **deliberately blocked from the agent** and kept behind an explicit human click. Parity isn't dogma — irreversible external exposure gets a human gate. That exception actually sharpens the principle: it's not "do *everything* by conversation," it's "make *everything that isn't dangerous* doable by conversation too."

Feedback follows the same logic. The old UX is "hunt for a feedback form → open it → send → wait for a reply." In the conversational-parity version, you just say the friction in the chat and it gets captured and routed to the right place — so the user doesn't become [the bottleneck re-relaying feedback](/en/blog/monitoring-closed-loop-route-en/). (This is a design principle we aim at.)

## Takeaways

- **Conversational parity**: every click-action should have a conversational path alongside it. Not removing menus — not skipping any.
- The industry made *recall* conversational and proved parity works — **so why stop there.** When even enabling that feature starts with a menu, that's half-built parity.
- "A shape outlives the constraint that justified it" — agent UX is sitting in that trap.
- **Parity isn't dogma**: keep irreversible/public/privacy actions behind a human gate. The core is making *everything that isn't dangerous* sayable too.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
