---
title: "One recreate and the vector DB never came up — compose `${VAR}` interpolation ≠ env_file"
description: "Recreating one worker dragged the vector DB along, and it hung at 'starting'. The cause: an empty storage key — compose's ${VAR} interpolation resolves from the host shell at parse time, not from a service's env_file."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["docker-compose", "vector-database", "object-storage", "silent-failure", "credentials", "root-cause-analysis"]
category: "infra"
lang: "en"
translationKey: "compose-interpolation-not-env-file"
sourceIntake:
  - "docs/intake/from-infra/2026-05-31-compose-interpolation-not-env-file.md"
draft: false
redactionReviewed: true
---

## TL;DR

- To rebuild just one worker container, I ran `docker compose up -d --force-recreate <worker>`. But compose followed the dependency graph and **recreated the vector DB too**, which then hung forever at `health: starting`.
- The real cause was an **empty storage key**. The vector DB was blocked with `400` on its object-storage bucket so an internal coordinator couldn't register — with no error, just the single word "starting."
- Why was the key empty — **docker-compose's `${VAR}` interpolation resolves at *parse time* from the host shell (or a top-level `.env`).** An `env_file` on the service doesn't help. `env_file` is the *inside-container* environment; it **contributes nothing** to `${...}` interpolation. They're different layers.
- In a shell without the credentials, the moment `--force-recreate` rebuilt that service, the interpolated value baked in as an empty string.

> **Source note.** This post distills a top-level infra-team intake (`docs/intake/from-infra/2026-05-31-compose-interpolation-not-env-file.md`). The object-storage provider/bucket, real env-var names, service/file names, and the vector-DB product name are generalized. No real key value appears anywhere — this covers only the *symptom* that the key was empty. The trap is local-dev-only (production uses a different secret mechanism, so this interpolation trap doesn't exist there), and the remediation has shipped.

## Touching one worker stalled the vector DB

While validating something else (a worker startup command), I used `--force-recreate` to rebuild just one worker container. But compose followed the **dependency graph** and recreated the vector DB too. And that vector DB then never passed its healthcheck — minutes in, still `health: starting`. The worker came up, but app init was stuck retrying the vector-DB connection, and the scheduler exited on connection failure.

The first suspicions ran the natural way: "is the vector DB slow to boot?" → "did the restart shock corrupt internal state (coordinator not registered)?" But neither a plain restart nor a full recreate cleared it. Narrowing the logs surfaced the real cause.

## What the logs pointed at — an empty storage key

This vector DB is made of several internal components (meta / data / query coordinators, etc.). In the logs, the **meta coordinator was `Healthy`**, while the **data and query coordinators retried endlessly** with "find no available …, check … state." And in between, the decisive line.

```text
storage ... ["failed to check blob bucket exist"] [bucket=<…>] [error="400 Bad Request"]
```

This vector DB stores its meta/data in object storage (S3-compatible). And that **bucket access was failing with `400`**. The data/query coordinators can't register if storage init fails → the "starting" loop. The vector DB wasn't broken — **the storage credentials were empty.** A warning I'd been glossing over finally registered.

```text
WARN: The "OBJSTORE_ACCESS_KEY" variable is not set. Defaulting to a blank string.
```

## Why empty — interpolation isn't env_file

The vector-DB service was receiving its storage keys like this.

```yaml
services:
  vectordb:
    env_file:
      - ./path/to/secrets.env   # ← inside-container env. Contributes nothing to ${...}.
    environment:
      OBJSTORE_ACCESS_KEY: "${OBJSTORE_ACCESS_KEY}"   # ← resolved at parse time from host/.env
      OBJSTORE_SECRET_KEY: "${OBJSTORE_SECRET_KEY}"   #   empty string if not in the shell
```

Here's the heart of the trap. `${...}` is resolved **when compose parses the file**, from the **host shell environment** (or a top-level `.env` in the same directory). The service also had an `env_file` — but **`env_file` only populates the *inside-container* environment; it contributes nothing to parse-time `${...}` interpolation.** Two entirely different layers.

So when the operator brought the stack up from a shell with credentials loaded, it was fine. But from a **shell without them**, the moment `--force-recreate` rebuilt the vector DB, `${OBJSTORE_ACCESS_KEY}` baked in as an **empty string**. An empty key fails bucket auth → `400` → the coordinator can't come up → stuck — all of it with no error, just "starting."

Recovery was almost anticlimactic: **load the credentials into the shell**, then recreate the vector DB. The data volume was fine — it was a credentials problem, not corruption.

## The real lesson is the asymmetry

Other services in the same stack (worker, scheduler) take their credentials via `env_file`, so they're **always fine regardless of the shell**. Only the vector DB took them via `${...}` **host interpolation**, depending on the shell. That asymmetry is the trap.

"The stack usually comes up fine, so the credentials must be getting in somewhere" quietly breaks the moment the recreate target happens to be the **interpolation-dependent** service. And the `env_file` attached to that service gives **a false sense that "credentials come from the file, so we're safe"** — even though what actually filled the key was the host shell, not that file.

The small conclusion: load the credentials and recreate. The big one: **compose's `${VAR}` interpolation and a service's `env_file` are different mechanisms, and when a stack mixes the two, "recreate safety" varies per service.** Pin interpolation-dependent values in a top-level `.env` (auto-loaded by compose) to remove the shell dependency.

```bash
# The right way: remove the shell dependency with a top-level .env (auto-loaded by compose).
#   Keep a .env.example as a template so "which ${VAR}s are needed" is visible.
# Ad-hoc recovery: load credentials into the shell, then recreate.
set -a; source path/to/secrets.env; set +a
docker compose up -d --no-deps --force-recreate vectordb   # --no-deps caps the blast radius
```

## Takeaways

- **`${VAR}` interpolation ≠ `env_file`.** Interpolation resolves at parse time from the host shell / top-level `.env`; env_file is the inside-container env. Different layers. env_file does not fill `${...}`.
- **`--force-recreate` from a shell without credentials silently injects empty strings.** The "variable is not set, defaulting to blank" warning is easy to miss.
- **`--force-recreate <svc>` recreates dependencies too.** To touch just one service, use `--no-deps`.
- **An object-storage-backed vector DB can't register if storage access is blocked.** Symptom is "just starting," cause is auth far away — if only the meta coordinator is Healthy, suspect storage.
- **If credential injection differs per service, "recreate safety" becomes asymmetric.** Pin interpolation-dependent values in a top-level `.env`.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
