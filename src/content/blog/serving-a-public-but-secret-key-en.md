---
title: "Public to serve, secret to keep — reclassifying an ownership-proof key"
description: "We classified an ownership-proof key as 'public' and committed it to git. But the docs call it semi-secret. A value served publicly yet kept out of git? Serve it from an edge Worker secret, not a static file."
pubDate: 2026-06-04
author: "Ascendy Engineering"
tags: ["cloudflare-workers", "secrets-hygiene", "secret-classification", "code-review", "indexnow"]
category: "infra"
lang: "en"
translationKey: "serving-a-public-but-secret-key"
sourceIntake:
  - "docs/intake/from-infra/2026-06-03-ownership-key-semi-secret.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Building a search-indexing notification (IndexNow) Worker, we classified the domain ownership-proof key as **"public — search engines fetch it by URL anyway."** So we committed it, in plaintext, to a config file without a second thought.
- **That was wrong.** Review stopped us with the official docs — *"Only you and the search engines should know the key and your file key location."* This key isn't public; it's a **semi-secret.** Anyone who knows it can submit **forged** re-index notifications for our whole domain (low-severity, but not zero).
- The trap is one sentence: **"fetchable from an endpoint ≠ fine to write in plaintext into git."** A search engine fetching it and the key being baked into git history / PRs are different exposures.
- The fix: instead of a static file, have an **edge Worker serve `/<key>.txt` directly from a secret.** The key and the path it lives at both stay out of git, while serving stays public.

> **Source note.** This post distills a top-level infra-team security-hygiene retrospective (`docs/intake/from-infra/2026-06-03-ownership-key-semi-secret.md`). The domain, Worker name, key path, and PR numbers are generalized, and **no real key value appears anywhere.** This misclassification was **caught in review before publishing** and ended in a rotate + redesign — which is itself one of the lessons.

## "Wait — is this value actually public?"

To speed up search-engine crawling, we built a Worker that auto-notifies the index. The protocol proves domain ownership by placing a key file at `https://<host>/<key>.txt` and sending that key along with every notification.

We classified this key as a **"public ownership-proof value."** The logic was simple — *the search engine has to fetch it by URL anyway, so isn't it a public value anyone can see?* So we committed it, in plaintext, into a config file, and had the static site publish `/<key>.txt`.

Review stopped us. The reviewer brought the official docs.

> *"Only you and the search engines should know the key and your file key location."*

So the key isn't a *public value* — it's a **semi-secret.** Anyone who knows it can submit **forged** "this URL changed" re-index notifications for our entire domain. They can't read or delete anything, and the severity is low — but it isn't zero. Our "it's fine to be public" premise was simply wrong.

## The trap — "fetchable" and "OK to commit" are different

When we committed the key to git, our judgment was "it's fetchable by URL anyway, so it's public." The trap was exactly there.

> **Fetchable from an endpoint ≠ fine to write anywhere.**

A search engine fetching `/<key>.txt` and that key being baked into git history, PRs, and handoffs are **different exposures.** The former is intended publication (ownership verification); the latter scatters the key permanently, searchably, irreversibly. That's why the docs say *the key's location* should be known only to you and the search engines — obscurity is part of the defense, however weak.

> **Lesson 1 — before committing a value, explicitly classify "is this a secret?"** Not by gut feeling of "seems fine to be public," but by *what someone who knows it can do.* If forged submissions are possible, it's a semi-secret — low-severity or not — and it belongs outside git.

## The pattern — serve it publicly without keeping it in git

Reclassified as a semi-secret, a tricky constraint appeared. The key file must be **served publicly** at `/<key>.txt` (the search engine fetches it without auth). Yet the key value and the path it lives at must be **out of git.** A static file can't satisfy both — the file goes into the repo.

The fix was to have a **Worker serve the key file directly.**

```js
// If the path is exactly /<key>.txt, return the secret. No auth —
// the search engine must fetch it for ownership verification (intended publication).
if (env.OWNERSHIP_KEY) {
  const keyPath = `/${env.OWNERSHIP_KEY}.txt`;
  if (path === keyPath) {
    return new Response(env.OWNERSHIP_KEY, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
// Every other path goes through an auth gate (operator-only).
```

- The key is an **edge Worker secret.** The operator generates it and injects it only as a secret, sharing the value with no one (agents included) → it lands in no repo, log, or handoff.
- The notification's `keyLocation` is **assembled at runtime** as `host + "/" + secret + ".txt"` → not even the key-bearing URL is stored.
- The route (`/<key>.txt → Worker`) **has the key in its path**, so it isn't committed to a config file — the operator sets it out-of-band via dashboard/CLI.

```bash
# The operator generates the key and injects it only as a secret — never shared or committed.
openssl rand -hex 16 | tr -d '\n' | wrangler secret put OWNERSHIP_KEY
# Don't print the key even when verifying (it's semi-secret):
test "$(curl -fsS "https://<host>/$KEY.txt")" = "$KEY" && echo ok
```

The result: the static site holds no key file, neither the key value nor the key path is in git, and the search engine fetches `/<key>.txt` as usual. And the **already-exposed old key was rotated** — having never gone live, it never became valid, so discarding it was enough.

> **Lesson 2 — a value that must be served publicly but kept out of git can satisfy both by being served from an edge secret instead of a static file.** When the filename/path itself is the secret, keep the config that holds that path (the route) out of commits too, via operator injection.

## And — review catching it is the system working

One part of this story shouldn't be dropped. The misclassification was **caught in review before merge.** A line of "wait, isn't this a secret?" before committing would've been faster — but at least it was caught before going live, and ended cleanly in a rotate + redesign.

> **Lesson 3 — review catching a classification mistake isn't an accident; it's the system working.** In security hygiene, "review did its job" is a good signal. For a key that never went live, the cost of the exposure is only the *time to redesign*.

## Takeaways

- **"Fetchable from an endpoint" does not mean "fine to leave in plaintext in git."** Ownership-proof tokens are semi-secrets: served publicly, but treated as secret.
- **Classify before committing** — by what someone who knows the value can do. If forged submission is possible, keep it out of git.
- **When you need public serving and out-of-git at once,** serve from an **edge Worker secret** instead of a static file. Keep the route that holds the key-path out of commits too.
- **An exposed-but-never-published key only needs a rotate.** Never live means never valid.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
