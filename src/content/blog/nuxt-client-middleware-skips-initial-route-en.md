---
title: "How a fixed bug came back — and how the diagnosis flipped a second time"
description: "A session-expired redirect broke; the fix was alive, only the path to it was cut. We blamed a 'Nuxt trait' — also wrong: middleware ignores `.client`, a naming artifact. A fact-check drove the code fix."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["nuxt3", "ssr", "middleware", "session-expired", "incident-prevention", "playwright"]
category: "frontend"
lang: "en"
translationKey: "nuxt-client-middleware-skips-initial-route"
sourceIntake:
  - "docs/intake/from-frontend/2026-05-30-nuxt-client-middleware-skips-initial-route.md"
draft: false
redactionReviewed: true
---

## TL;DR

- After a session expired, opening a protected page (`/gallery`) should bounce you to login — but it just stayed. The same bug had **been fixed once before.**
- And that fix code was **alive and well.** What had died wasn't the code — it was the **path that reaches it.** On a cold load (URL typed in, bookmark, tab restore), that middleware never ran at all.
- We first diagnosed it as *"Nuxt 3's `.client` global middleware doesn't fire on the SSR initial route."* **That was wrong too.** Nuxt 3 middleware, unlike plugins, **doesn't support `.client`/`.server` suffixes.** The `.client` in `*.global.client.ts` was a **leftover token** the middleware loader doesn't recognize — which is why it behaved unlike our intent.
- The canonical pattern is `.global.ts` (universal) + an `import.meta.server` branch in the body. And this second correction was **drawn out by a fact-check during publishing** — the post fixed the code.

> **Source note.** This post distills an intake the frontend team left while tracking a session-expired redirect regression (`docs/intake/from-frontend/2026-05-30-nuxt-client-middleware-skips-initial-route.md`). While preparing it for publication, the blog's editorial side fact-checked the original diagnosis (a "Nuxt trait" where `.client` middleware doesn't run on SSR) against the official docs and **found it inaccurate**, and that feedback led the frontend team to a code fix (canonicalizing the filename + an `import.meta.server` branch). This post carries the corrected diagnosis. Internal hostnames, endpoints, and specific component paths are generalized.

## A live fix, a cut path

The report was simple: "open `/gallery` with an expired session and it doesn't send me to `/login`." A security/UX regression. And this symptom had a record — we'd already fixed it once, by putting a `sessionExpired` branch and `navigateTo('/login')` into the global client middleware. So at first it looked like a plain regression where someone had reverted that fix.

So we set three hypotheses and attached a **falsifying command** to each up front. Instead of piling on guesses, we decided how to knock each one down first.

- **(a) Did the fix itself disappear?** → `git log` showed the prior fix commits intact. **False.**
- **(b) Does a new HTTP client bypass the axios interceptor?** → `grep` found no such path. **False.**
- **(c) Did a new protected route forget the `requiresAuth` meta?** → `/gallery` still had `definePageMeta({ requiresAuth: true })`. **False.**

All three false. When three hypotheses all fall, what's left is a **fourth thing** you haven't suspected yet.

## The decisive clue: the middleware never ran

We ran a cold-load scenario in Playwright (fresh browser, URL typed directly). The console logs gave it away — **zero** `[middleware]` lines. The fix wasn't useless; **the middleware never executed at all.**

The prior fix lived inside exactly that global client middleware. The code was alive, but sitting **somewhere a cold load can never reach.** Walk around the app and let the session expire (a client transition) and it worked fine — which is why nobody noticed for a while. The hole opened only when you opened a protected URL **directly** with an expired session.

## The first diagnosis, and the fact-check that flipped it

The diagnosis we first reached was this.

> *"Nuxt 3's `.client` global route middleware does not fire on an SSR-rendered initial route."*

It was plausible — it matched the observed behavior. But while polishing this post for publication, checking that diagnosis **against the official docs one more time** broke it. We had to correct it.

Per the [Nuxt 3 middleware docs](https://nuxt.com/docs/3.x/directory-structure/middleware) — **middleware, unlike plugins, does not support `.client`/`.server` filename suffixes.** Environment branching belongs *inside* the middleware code, via `import.meta.client` / `import.meta.server`. Our filename `*.global.client.ts` triggered global registration through `.global`, but the `.client` was a **leftover token the middleware loader doesn't recognize.**

So "Nuxt doesn't run a `.client` global middleware on SSR" wasn't a **framework trait — it was an artifact of the non-standard filename we'd given it.** A non-standard name producing *seemingly-intentional behavior* (appearing not to run on SSR) made it easy to over-generalize into "that's just how Nuxt works." Checking *why* it behaves that way against the docs, before generalizing, is exactly what guards against this trap.

## Fix: return to the canonical pattern, keep the intended safety net

We brought the code back to the canonical pattern to match the corrected diagnosis.

- Drop `.client` from the global middleware filename to make it **`.global.ts` (universal)** (preserving file history), and add `if (import.meta.server) return` as the first line of the body. **External observable behavior is identical** — early return on web's SSR pass (the same as the non-standard suffix bypassing SSR before), runs on hydration and subsequent client navigation, and is a no-op on native (no SSR pass).

But the guard that actually catches the cold load lives not in the middleware but in a **plugin (which runs at app boot)** — and that one we **kept on purpose.** It captures "were they logged in" before hydration, and after it, if there's no user, sends them to login.

```ts
// app-boot plugin — cold-load guard (the intended safety net, kept)
const wasLoggedIn = authStore.isLoggedIn   // capture BEFORE the await
await hydrateUser()                         // 401 during fetchUser → interceptor → logout → cookie cleared

if (!authStore.user) {
  const route = useRoute()
  const onProtectedRoute = Boolean(route.meta?.requiresAuth)
  if ((wasLoggedIn || onProtectedRoute) && route.path !== '/login') {
    window.location.replace('/login')
    return
  }
}
```

Why keep that guard in the plugin instead of folding it into the middleware? That plugin gathers client-only behavior — biometrics, the native splash, the cold-load guard — in one file, and touching it wrong risks pinning every native user on the splash (so an internal rule marks it "ask first"). And that guard is locked by the e2e below, with the reason for the hard navigation (the race below) spelled out in a comment — meaning it's **an intended race-handling safety net, not code accidentally papering over a non-standard middleware.** The same line means different things depending on the guards around it (spec, comment, rule).

## A small follow-up: navigateTo didn't take

We first wrote that guard with `navigateTo('/login')` — and **the redirect didn't happen.**

It was a boot-time race. On a garbage-cookie cold load, during the plugin's `await fetchUser()`, the axios 401 interceptor already queues `router.push('/login')` from inside `logout()`. Then our guard queues `navigateTo('/login')` too. **Both race the SSR-committed `/gallery` route, and in practice none of the three commits.** The URL sat on `/gallery` (confirmed via Playwright trace).

`window.location.replace` is at the browser level, so it breaks that race and loads `/login` cleanly. The SPA state goes with it — which on a session-recovery path is **exactly** what you want. SPA routing is right in normal operation, but **during app boot there are moments when no SPA navigation can be trusted**, and on a recovery path that's when `window.location` is the answer.

## The real cause was "there was no locked test"

Fixing a bug and keeping the same bug from coming back are two different jobs. The **real cause** of this regression wasn't the middleware naming — it sat above it: the prior fix had only been smoke-tested by hand on client-side navigation, and **the cold-load matrix had no locked test at all.** So when the regression got unblocked, nobody saw it.

So we pinned two cold-load cases (no cookie / garbage cookie) into a Playwright spec and put it in the PR-gating CI.

```ts
test.use({ storageState: { cookies: [], origins: [] } })

test('no cookie + go to /gallery → /login', async ({ page }) => {
  await page.goto('/gallery', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login(?:$|\?|#)/, { timeout: 10_000 })
})

test('garbage auth-token cookie + go to /gallery → /login', async ({ page, context }) => {
  await context.addCookies([
    { name: 'auth-token', value: 'totally-not-a-jwt', domain: 'localhost', path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600 },
  ])
  await page.goto('/gallery', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login(?:$|\?|#)/, { timeout: 10_000 })
})
```

## Takeaways

- **Nuxt 3 middleware doesn't support `.client`/`.server` suffixes (those are plugin-only).** Branch by environment in the body via `import.meta.client`/`import.meta.server`, not by filename. A name like `*.global.client.ts` registers via `.global`, but the `.client` is a meaningless leftover token.
- **Beware a non-standard name producing *seemingly-intentional behavior*.** Before generalizing into "that's just how the framework works," check *why* it behaves that way against the official docs — that step guards the trap.
- **Navigation during app boot can race and lose.** SSR-committed route + interceptor push + plugin push queued together can leave none committed. On a recovery path, `window.location.replace` is reliable.
- **Diagnose regressions by writing hypotheses + falsifying commands first.** State (a)(b)(c) and attach `git log -S` / `grep` / meta checks; knock them down one by one.
- **A regression test must reproduce the exact path that once broke.** "Fixed" and "locked so it can't break again" are different. Don't lock it, and the next regression slips in silently the moment it's unblocked.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
