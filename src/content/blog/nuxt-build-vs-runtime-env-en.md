---
title: "Build-time env vs runtime env — a login outage that fell into the same trap twice"
description: "Production login broke twice in Nuxt 3, both from one cause: confusing build-time vs runtime env. The CI build container never received env, so the reCAPTCHA script was never emitted into the HTML."
pubDate: 2026-05-28
author: "Ascendy Engineering"
tags: ["nuxt3", "recaptcha", "env", "build-vs-runtime", "capacitor"]
category: "frontend"
lang: "en"
translationKey: "nuxt-build-vs-runtime-env"
sourceIntake:
  - "docs/intake/from-frontend/2026-05-27-nuxt-build-vs-runtime-env.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Production login broke in **two stages**, and both had the same cause — confusion over whether Nuxt `runtimeConfig.public` **freezes at build time or is read at runtime**.
- `nuxt.config.ts` is evaluated at build time. The CI Docker build container doesn't receive `.env`, so a `<script>` tag built from build-time `process.env` **disappears as an empty value**.
- We thought catching the first 502 was the end, then fell into the same trap again. Lesson: **when you find one such pattern, immediately audit the adjacent build-time-eval surfaces.**

## Background — the first 502

Production login died with a 502, even though the pod's environment variables were set correctly. The cause was the ingress's **host-split** layout — the app and the API are split onto different hosts, but the client was calling the same-origin relative path `/api`, so the request routed to the frontend and returned 502. The backend never received the request.

> **An invisible-failure signal:** if the backend logs are empty but the client gets a 502, suspect a frontend → frontend self-loop.

Two recovery paths — (A) add a path rule to the ingress (recovers in minutes, but blurs the host-split design; infra work), or (B) have the client call the backend host directly (preserves host-split, needs a build+deploy cycle). With time to spare, we chose **B**: we moved the axios baseURL from a build-time relative path to a **runtime env-driven absolute URL**.

```ts
// axios client (excerpt) — env-driven baseURL, dev fallback
const isNative = Capacitor.isNativePlatform()
const config = useRuntimeConfig()
const webApiBase = (config.public.apiBase as string) || '/api'
const baseURL = isNative ? (config.public.nativeApiUrl as string) : webApiBase
```

## The second trap — same cause, different face

Login started reaching the backend. But this time: `RECAPTCHA_REQUIRED`. Tracing it down, it was the **same build-time vs runtime trap**.

The reCAPTCHA script was being injected via the `head.script` array in `nuxt.config.ts`. But `nuxt.config.ts` is **evaluated at build time**. The CI Docker build container doesn't receive `.env` (gitignored + dockerignored). So build-time `process.env.<...>_SITE_KEY` was empty, and the `<script src=...>` was **never even emitted** into the production HTML `<head>`. The pod's runtime env is read via `useRuntimeConfig().public`, but by then the HTML is already built and frozen.

The fix: instead of a build-time `head.script`, inject from a **runtime client plugin** that reads the site key via `useRuntimeConfig`. The build dependency disappears.

```ts
// runtime client plugin — third-party script injection (no build dependency)
import { Capacitor } from '@capacitor/core'
const SRC = 'https://www.google.com/recaptcha/api.js'

export default defineNuxtPlugin(() => {
  if (Capacitor.isNativePlatform()) return          // web only
  const siteKey = useRuntimeConfig().public.recaptchaSiteKey as string
  if (!siteKey || typeof window === 'undefined') return
  if ((window as any).grecaptcha) return             // idempotent guard
  if (document.querySelector(`script[src^="${SRC}"]`)) return
  const s = document.createElement('script')
  s.src = `${SRC}?render=${siteKey}`
  s.async = true
  document.head.appendChild(s)
})
```

## Decision / tradeoffs

To use a build-time env, we could have added Docker build args + a CI secret + a Dockerfile `ARG`. Why we rejected it: ① it grows the secret-exposure surface, ② it requires a rebuild on every site-key change, and ③ it forces build env and runtime env to **sync in two places**. Runtime injection only needs to look at the pod env in **one place**.

As a principle — consciously separate **what needs build time** (preload hints, critical CSS, head `src` that must be locked at build) from **what needs runtime** (API URL, feature flags, third-party site keys). `runtimeConfig.public` is server-injected, so the client sees deploy-time values, but the static parts of `nuxt.config.ts` freeze at build time and produce different results from the same env.

> If you run a Capacitor native app and the web on the same Nuxt codebase, branching on `isNativePlatform()` to skip web-only third-party scripts also has the side benefit of keeping native review from flagging external domains.

## What's next

- For fixes that share the same pattern (env-driven config), audit the adjacent build-time-eval points the moment you find the pattern in the first PR — it's the cheapest way to avoid a second production incident.
- See: [Nuxt runtime config](https://nuxt.com/docs/guide/going-further/runtime-config), [reCAPTCHA v3](https://developers.google.com/recaptcha/docs/v3).

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
