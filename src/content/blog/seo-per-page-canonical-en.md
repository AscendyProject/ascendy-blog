---
title: "'A global default OG is safe' is a lie — og:url and canonical have no default"
description: "The easy trap in a Nuxt SEO baseline: og:url and canonical have no meaningful default. With one global default, every page advertises root and risks search dropping it as a duplicate. Per-page override is mandatory."
pubDate: 2026-06-12
author: "Ascendy Engineering"
tags: ["nuxt", "seo", "open-graph", "canonical", "lessons-from-review"]
category: "frontend"
lang: "en"
translationKey: "seo-per-page-canonical"
sourceIntake:
  - "docs/intake/from-frontend/2026-06-12-seo-per-page-canonical.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Prepping for a public launch, I laid a Nuxt SEO baseline — `robots.txt`, `sitemap.xml`, and a **global default** Open Graph + Twitter Card in `nuxt.config.ts`.
- A Codex review caught it: **the global `og:url` is pinned to root, but the per-page `useSeoMeta` doesn't set `ogUrl` — so every public page advertises root (`ascendy.ai/`) as its OG canonical URL.** Confirmed with one line: `rg ogUrl pages/`.
- The point: **`og:url` and `<link rel="canonical">` are fields with *no meaningful default*.** They must differ per page; ship only a global default and (1) every page's social preview advertises the same root, and (2) you hand search engines a strong "root is the original" signal — so the other pages risk being folded into root as duplicates and dropped from the index.
- → **Per-page override isn't "optional" — it's mandatory.** 18 lines added `ogUrl` + `<link rel="canonical">` to 6 pages.

> **Source note.** Distilled from a frontend-team intake. The public domain `ascendy.ai` is already public, so it's used as-is in examples (no secrets or identifiers). Same *the-review-caught-it* vein as [how a fixed bug came back](/en/blog/nuxt-client-middleware-skips-initial-route-en/) and [the rename PR that was the widest PR](/en/blog/rename-pr-is-a-doc-sweep-en/).

## The one place "set a default and move on" breaks

Laying an SEO baseline, most guides say: *"Put default Open Graph meta in your `nuxt.config.ts` head and every page gets a baseline preview. Per-page override later, if needed."*

For most OG fields that's correct. `og:image`, `og:site_name`, a default `og:title`/`og:description` — if a page doesn't set its own, the default fills in sensibly.

But for **two fields, it's a trap: `og:url` and `<link rel="canonical">`.**

These declare *"what URL this page canonically is."* So a *default* value is meaningless by nature — every page can't share one. Pin `og:url` to `https://ascendy.ai/` in the global default and never override per page, and about, pricing, privacy, terms, licenses *all* declare their canonical URL to be `ascendy.ai/` (root).

## What that actually does

It breaks two ways.

1. **Social previews** — share `/about` or `/pricing`, and the OG card advertises `ascendy.ai/` either way. The link is "wrong," or at best loses the trust of "is this really that page?"
2. **Search indexing** — the more lethal one. One thing to be precise about: **`rel="canonical"` is a *signal*, not a *directive*.** Google picks the representative URL itself, weighing the canonical tag against other cues (internal links, sitemaps, redirects), and ignores it when the signals conflict. But when `<link rel="canonical">` points to root on every page, **about/pricing/privacy/terms/licenses all insist "my original is root"** — so Google is likely to pick root as the representative and *risks dropping the rest from the index.* Not a certainty, but you'd be planting, by hand, the very signal that can erase your pages from search while you "set up SEO."

A Codex review caught this with **one line**, `rg ogUrl pages/` — that no page had an `ogUrl` or canonical override anywhere. A defect a reviewer can catch with a single grep, and a small illustration of why review earns its keep.

## The fix — set both, per page

In Nuxt 3, `useSeoMeta` takes `ogUrl`, and canonical is a separate `useHead` link entry. Set both in the same PR.

```ts
// pages/about.vue (same pattern on the other public pages)
const pageUrl = 'https://ascendy.ai/about'
useSeoMeta({
  title: () => t('seo.about.title'),
  description: () => t('seo.about.description'),
  ogTitle: () => t('seo.about.title'),
  ogDescription: () => t('seo.about.description'),
  ogUrl: pageUrl,                              // ← the missing key
})
useHead({ link: [{ rel: 'canonical', href: pageUrl }] })  // ← + canonical for search
```

18 lines across 6 pages. That's all it was — a small omission, but with an outsized potential result ("every page risks disappearing from search").

(Note: hard-coding the prod host is a trade-off in multi-env setups. If dev/staging also need indexing, a dynamic sitemap + runtime config is right. With public pages being prod-only at this stage, pinning prod is correct.)

## Takeaways

- **`og:url` and `canonical` are fields with no meaningful default.** Distinct pages can't share one value, so a single global default can never be the right value for them. Per-page override isn't optional — it's mandatory.
- **A global default OG is a safe start — except these two fields.** Apply the rest-of-OG convention to them and every page advertises root and hands search a strong "pick root" signal that risks the rest being dropped as duplicates.
- **If canonical points to root everywhere, those pages risk falling out of the index.** Canonical is a signal, not a directive, so it's not guaranteed — but it's an own-goal waiting to happen: setting up SEO while seeding the signal that erases it.
- **A reviewer catches this with one `rg`.** The value of review is a separate pair of eyes grep-checking the assumption "I set a default, so it's fine."

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
