---
title: "Onboarding re-appeared on every login — why the 'quick fix' was wrong, and the real cause (a cold-load race)"
description: "Skip onboarding, it returns next login. Wrong guess: the parent never PATCHes — the child already did. Real cause: Pinia doesn't await $subscribe callbacks, so login hydration is fire-and-forget and races gallery mount."
pubDate: 2026-06-11
author: "Ascendy Engineering"
tags: ["nuxt", "pinia", "race-condition", "settings-hydration", "lessons-from-review"]
category: "frontend"
lang: "en"
translationKey: "onboarding-cold-load-race"
sourceIntake:
  - "docs/intake/from-frontend/2026-06-11-onboarding-cold-load-race.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Bug: **skip the onboarding wizard, and it pops up again on the next login.**
- **The first diagnosis was wrong.** "The gallery page only closes a local ref and never PATCHes the server" — so I opened a PR adding a PATCH call in the parent. But **the child component already calls `await updateUserSettings(...)` before it `emit('complete')`s.** A second PATCH in the parent would mean duplicate calls + toast noise. A Codex review caught it and the PR was closed.
- **The real cause = a cold-load race.** On a cold boot it's safe — Nuxt awaits the async plugin before mount. The bug is the **login-transition** path: the plugin registers `authStore.$subscribe(async () => await hydrate…)`, and **Pinia does not await a `$subscribe` callback (fire-and-forget).** The gallery mounts in the meantime, and the gate reads the default `onboardingCompleted = false` and shows the wizard.
- **Fix**: a `hasFetched` flag + `watch(..., { immediate: true })` — "don't evaluate the gate until the load is done." Why `hasFetched` guard (B) over default-true-then-override (A)? Because of *what happens when a first-time user's first fetch fails.*

> **Source note.** Distilled from a frontend-team intake. The backend API path and code locations are generalized/removed; no secrets or identifiers. Same *the-review-caught-it* vein as [how a fixed bug came back](/en/blog/nuxt-client-middleware-skips-initial-route-en/) and [the race a commented-out listener created](/en/blog/commented-out-listeners-race-en/).

## Symptom: a wizard that won't stay dismissed

The operator report was one line: *"Skip the onboarding wizard and it shows again next login."*

Onboarding is usually a one-time thing. Finish it once, the user's settings get `onboarding_completed: true`, and it never shows again. So "it comes back every login" means one of two things — **it isn't being saved server-side**, or **it is saved but read at the wrong time.**

## First diagnosis: "the parent never PATCHes the server"

The first call was the former. *"The gallery page's `@complete` binding only closes a local ref and doesn't PATCH the server."* It was plausible. If the dismiss handler only changes view state (`showOnboarding.value = false`) and never tells the server, the next login still gets `false`.

So I coded it: added an `onOnboardingComplete()` handler in the parent calling `updateUserSettings({ onboarding_completed: true })`, and opened a PR.

## What review caught: the child was already PATCHing

A Codex review blocked the PR. **The child component `MobileOnboardingWizard` already calls `await updateUserSettings(...)` before it `emit('complete')`s.**

So the dismiss flow already was:

1. Child: `await updateUserSettings({ onboarding_completed: true })` — **server PATCH done**
2. Child: `emit('complete')`
3. Parent: receives the event, sets `showOnboarding.value = false`

The save *was already happening.* The first diagnosis was wrong. Had I added a second PATCH in the parent, I'd only have bought **a duplicate PATCH + toast noise on every dismiss.** PR closed, branch deleted.

One lesson here — **when you're handed a wrong first diagnosis, don't code it straight; first check the opposite of what it claims** (does the child really *not* PATCH?). A diagnosis is a hypothesis, not a fact. In this case a reviewer (Codex) did that cross-check instead of a human.

## The real cause: a cold-load race

If it's being saved, the problem is **when it's read.** And the picture I first drew was *wrong* — that's the second twist of this story.

The settings-loading function `hydrateUserAndSettings()` (→ `await fetchUserSettings()`) lives in the auth-init plugin and is called from **two places.**

1. **Cold-boot path** — `defineNuxtPlugin(async () => { … await hydrateUserAndSettings() … })`. When the app starts with a stored token, it awaits directly inside the plugin setup.
2. **Login-transition path** — a `authStore.$subscribe(async (_m, state) => { if (loggedIn) await hydrateUserAndSettings() })` the plugin registers. It fires when the token changes (i.e., a login) while the app is already running.

I first wrote "the plugin `await`s `fetchUserSettings()`, and the gallery's `onMounted` races it." But **on path 1 that's impossible.** Nuxt **awaits the promise returned by an async plugin setup before it mounts the app.** If the plugin truly waits for the fetch, every component's `onMounted` runs after it. On a cold boot the gate already sees the *fetched* value — no race.

**The real race is path 2.** And the crux fits in one line — **Pinia does not await a `$subscribe` callback.** It throws away the promise an async subscriber returns. So when a login flips the token, `$subscribe` kicks off `hydrateUserAndSettings()` *fire-and-forget*, while the router moves to `/gallery` and mounts the component. The moment the gallery's gate evaluates, `fetchUserSettings()` is still in flight, so the gate reads the store's **default `onboardingCompleted = false`** and shows the wizard. The fetch later returns `true`, but the gate has *already fired*.

Here's the generalizable lesson — **whether an `await` serializes within a function isn't the end of it; what matters is *who awaits that await*.** Nuxt awaits the plugin setup; Pinia doesn't await the `$subscribe` callback. The *same* hydration function serializes when called one way and runs fire-and-forget when called another. "The plugin awaits, so it's safe" is true only for path 1 — the bug was hiding in path 2.

## Fix: "don't evaluate until the load is done"

The fix is to make the gate look at the *loaded* value, never the *default*. Add a `hasFetched` flag to the store that signals "a fetch has completed at least once," and turn the gate into a watcher that reacts to it.

```ts
// stores/settings.ts — hasFetched flag
const hasFetched = ref(false)

async function fetchUserSettings(): Promise<void> {
  isLoading.value = true
  try {
    const { data } = await api().get<UserSettingsPublic>("/me/settings")
    applySettingsToState(data)
  } catch (err) {
    console.error("[settings] fetchUserSettings failed:", err)
  } finally {
    isLoading.value = false
    hasFetched.value = true  // on success OR error
  }
}
```

```ts
// pages/gallery/index.vue — replace the inline onMounted gate with a watcher
watch(
  () => settingsStore.hasFetched,
  (loaded) => {
    if (!loaded) return            // not loaded yet — don't evaluate
    if (!authStore.user) return
    if (!settingsStore.onboardingCompleted) {
      showOnboarding.value = true
    }
  },
  { immediate: true },
)
```

With `{ immediate: true }`, a revisit (already loaded) evaluates instantly; a fresh load evaluates when `hasFetched` flips to `true`. The race window is gone.

Flipping `hasFetched` to `true` in `finally` **on success *or* error** matters — see the next section.

## Why hasFetched guard, not default-true-then-override

There were two options.

- **A. Default-true-then-override** — default `onboardingCompleted` to `true`, then overwrite with the server value after fetch. The gate stays quiet by default and only fires if the server says `false`.
- **B. hasFetched guard** — keep a separate "load complete" flag and don't evaluate the gate until it's `true`.

A is shorter — barely a line; just change the default. But A's **failure mode is dangerous.** Say a genuine first-time user's first `fetchUserSettings()` fails transiently (a network blip, a cold backend). With A, `onboardingCompleted` stays at its default `true`, so **onboarding never shows** — to exactly the person who needs it most.

B handles that cleanly. Even if the fetch fails, `finally` sets `hasFetched = true`, and `onboardingCompleted` stays at its store default — `false` for a new user. The gate evaluates and the wizard shows. B **separates "not loaded yet" from "loaded, and the server says false."** A collapses both into a single default value.

Backend explicitly recommended B and frontend reached the same conclusion. The extra line earned its keep.

## Takeaways

- **Whether an `await` serializes matters less than *who awaits it*.** The same hydration function is awaited before mount when called from a Nuxt plugin setup (cold boot), but runs **fire-and-forget** when called from a Pinia `$subscribe` callback (login transition) — because Pinia doesn't await subscribers. The latter races component mount. Suspect any "async but the caller doesn't wait" entry point: `$subscribe`, `watch`, event handlers.
- **Be suspicious of gates that read default values.** Any UI gate evaluated before hydration can mistake "a value that hasn't arrived" for "the value the server gave." A *load-complete signal* like `hasFetched` + `watch(immediate: true)` is the general remedy.
- **The difference between the two fix shapes is the first-time user's failure mode.** default-true hides onboarding forever on a failed fetch; the hasFetched guard distinguishes "not loaded" from "server says false." The shorter fix isn't always the right one.
- **Don't code a wrong first diagnosis as-is.** A diagnosis is a hypothesis. Here a reviewer cross-checked that the child was already PATCHing — review-driven development cutting a wasted detour.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
