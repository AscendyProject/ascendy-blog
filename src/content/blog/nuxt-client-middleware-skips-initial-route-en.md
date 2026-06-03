---
title: "How a fixed bug came back — Nuxt 3 `.client` middleware skips the SSR initial route"
description: "A session-expired redirect broke — the fix was alive, only the path to it was cut. The culprit: Nuxt 3's `.client` global middleware doesn't run on the SSR initial route. How we tracked it down and locked the regression."
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
- And that fix code was **alive and well.** What had died wasn't the code — it was the **path that reaches it.**
- The culprit was a Nuxt 3 trait: **`.client` global route middleware doesn't run on an SSR-rendered initial route** (URL typed in, bookmark, tab restore). It only runs on client-side route transitions. Put a protected-route guard only there, and cold loads bypass it entirely.
- Fixing it surfaced one more thing — during app boot even `navigateTo` can't be trusted, so on a recovery path `window.location.replace` was the answer.

> **Source note.** This post distills an intake the frontend team left while tracking a session-expired redirect regression (`docs/intake/from-frontend/2026-05-30-nuxt-client-middleware-skips-initial-route.md`). Internal hostnames, endpoint paths, PR numbers, and component paths are generalized. The pattern is specific to Nuxt 3 + SSR (+ Capacitor) setups.

## A live fix, a cut path

The report was simple: "open `/gallery` with an expired session and it doesn't send me to `/login`." A security/UX regression. And this symptom had a record — we'd already fixed it once, by putting a `sessionExpired` branch and `navigateTo('/login')` into the global client middleware. So at first it looked like a plain regression where someone had reverted that fix.

So we set three hypotheses and attached a **falsifying command** to each up front. Instead of piling on guesses, we decided how to knock each one down first.

- **(a) Did the fix itself disappear?** → `git log` showed the prior fix commits intact. **False.**
- **(b) Does a new HTTP client bypass the axios interceptor?** → `grep` found no such path. **False.**
- **(c) Did a new protected route forget the `requiresAuth` meta?** → `/gallery` still had `definePageMeta({ requiresAuth: true })`. **False.**

All three false. When three hypotheses all fall, what's left is a **fourth thing** you haven't suspected yet.

## The decisive clue: the middleware never ran

We ran a cold-load scenario in Playwright (fresh browser, URL typed directly). The console logs gave it away — **zero** `[middleware]` lines. The fix wasn't useless; **the middleware never executed at all.**

That exposed the culprit.

> **Nuxt 3's `.client` global route middleware does not fire on an SSR-rendered initial route.**

A **first** route reached by typing a URL, hitting a bookmark, or having the browser restore a tab is rendered on the server. When the client hydrates that page, the route's global client middleware is **not re-run.** The middleware kicks in only from the next client-side route transition (a link click, etc.).

The prior fix lived inside exactly that global client middleware. The code was alive, but sitting **somewhere a cold load can never reach.** Walk around the app and let the session expire (a client transition) and it worked fine — which is why nobody noticed for a while. The hole opened only when you opened a protected URL **directly** with an expired session.

## Fix: move the guard to where cold loads run

There were two branches.

1. Drop `.client` from the middleware filename to make it universal. But fetching the user on the SSR side needs a server-side instance (the client-only API is unavailable during SSR).
2. Put a guard in a place that definitely runs on a cold load — the **auth-init plugin**. More surgical.

We took #2. Capture "were they logged in" before hydration, and after it, if there's no user, send them to login.

```ts
// auth-init plugin — cold-load guard
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

## A small follow-up: navigateTo didn't take

We first wrote that guard with `navigateTo('/login')` — and **the redirect didn't happen.**

It was a boot-time race. On a garbage-cookie cold load, during the plugin's `await fetchUser()`, the axios 401 interceptor already queues `router.push('/login')` from inside `logout()`. Then our guard queues `navigateTo('/login')` too. **Both race the SSR-committed `/gallery` route, and in practice none of the three commits.** The URL sat on `/gallery` (confirmed via Playwright trace).

`window.location.replace` is at the browser level, so it breaks that race and loads `/login` cleanly. The SPA state goes with it — which on a session-recovery path is **exactly** what you want.

There's a generalizable lesson here. SPA routing is right in normal operation. But **during app boot there are moments when no SPA navigation can be trusted**, and on a recovery path that's when `window.location` is the answer.

## The real cause was "there was no locked test"

Fixing a bug and keeping the same bug from coming back are two different jobs. The **real cause** of this regression wasn't the Nuxt trait — it sat above it: the prior fix had only been smoke-tested by hand on client-side navigation, and **the cold-load matrix had no locked test at all.** So when the regression got unblocked, nobody saw it.

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

- **`.client` global middleware doesn't run on the SSR initial route.** Don't put a protected-route guard only there. Put the guard where cold loads run (a plugin / page-level), or make the middleware universal.
- **Navigation during app boot can race and lose.** SSR-committed route + interceptor push + plugin push queued together can leave none committed. On a recovery path, `window.location.replace` is reliable.
- **Diagnose regressions by writing hypotheses + falsifying commands first.** State (a)(b)(c) and attach `git log -S` / `grep` / meta checks; knock them down one by one. If all fall, suspect a fourth thing like a framework trait.
- **A regression test must reproduce the exact path that once broke.** "Fixed" and "locked so it can't break again" are different. Don't lock it, and the next regression slips in silently the moment it's unblocked.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
