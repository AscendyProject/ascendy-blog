---
title: "ERROR showed, INFO vanished — the two traps that swallowed our Celery logs"
description: "A Celery worker logged zero INFO lines while ERROR showed fine. Two layers: Python logging uninitialized at the worker entry point, and a YAML block scalar that let bash chop the worker command apart."
pubDate: 2026-05-31
author: "Ascendy Engineering"
tags: ["celery", "python-logging", "docker-compose", "yaml", "observability", "debugging"]
category: "backend"
lang: "en"
translationKey: "celery-silent-info-logs"
sourceIntake:
  - "docs/intake/from-backend/2026-05-30-silent-celery-info-and-yaml-newlines.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Our Celery worker logged **not a single** "task started" INFO line. But ERROR lines showed up fine — that **asymmetry** was the starting point for every clue.
- The cause wasn't one bug but **two layers**: ① Python logging never initialized at INFO at the worker entry point; ② a docker-compose YAML block scalar (`|-`) preserved newlines, so bash chopped the worker command apart and silently dropped its arguments.
- The lesson: assuming "one symptom, one cause" is dangerous. And most of the debugging time goes not into the fix but into **noticing the asymmetry**.

## Background — "not running" and "running but muted" are different

While chasing another issue, I noticed the worker logs had zero task-start INFO lines. My first suspicion was "the worker died and tasks aren't running." But ERROR lines were printing just fine.

**ERROR shows, INFO doesn't.** That asymmetry points away from "tasks aren't running" and toward "tasks run, but the INFO level is muted." So I separated the two first — with an **active probe** that dispatches a task with a non-existent id to force a single `logger.error(...)`.

```bash
# Probe to tell whether the dispatch + consume path is alive:
# a non-existent id triggers logger.error(...) via the not-found path
docker compose exec backend python -c "
from app.tasks.your_task import your_task
your_task.delay(99999)  # not-found path triggers logger.error
"
docker compose logs worker --since 30s | grep your_task
```

ERROR appeared in the worker's stdout. That meant dispatch and consume were healthy, and suspicion narrowed straight to **"INFO is being filtered out."**

## Cause 1 — Python logging never initialized in the worker

`logging.basicConfig(level=INFO)` only ran **when the web app was imported**. The worker is a different entry point into the same code, so it started with the root logger at the default WARNING — muting every `logger.info(...)` in the app modules.

On top of that, Celery prefork child processes can have their logging level re-touched by Celery's own setup even after fork, so configuring once in the parent wasn't enough. Three pieces together kept INFO alive down into the prefork children.

```python
# At the top of the worker/beat entry module: keep INFO alive in every process
import logging
from celery.signals import setup_logging, worker_process_init


def _configure_app_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        force=True,
    )


_configure_app_logging()


@setup_logging.connect
def _skip_celery_logging_setup(**kwargs):
    """If any handler is connected to this signal, Celery skips its own logging setup."""
    return


@worker_process_init.connect
def _init_logging_in_prefork_child(**kwargs):
    """Re-apply once per prefork child — fork inherits handlers, but Celery's
    per-child setup can revert the level."""
    _configure_app_logging()
```

## Cause 2 — a YAML block scalar chopped the command apart

Even after INFO came back, something was off: the worker's `--concurrency` setting was being ignored. Inspecting the container's actual CMD revealed that `--loglevel`, `--queues`, `--concurrency`, and `--max-memory-per-child` were running **as separate (and failing) shell commands** inside the container.

The culprit was `command: |-` in compose. A literal block scalar (`|`) **preserves** the LF on every line. When that reaches `bash -lc "..."`, bash treats the unquoted LFs as **command separators**. So in reality only `celery ... worker` ran, with zero arguments, and every other line scattered into separate (failing) commands. **A single bug** was simultaneously dropping concurrency, the memory limit, and the log level.

```yaml
# BAD: literal `|-` preserves LFs → bash treats LF as a command separator
command: |-
  celery -A app.celery_app:celery worker
    --loglevel=INFO
    --queues=default,heavy
    --concurrency=1

# OK 1: folded `>-` folds LFs into spaces → arrives as a single command
command: >-
  celery -A app.celery_app:celery worker
    --loglevel=INFO
    --queues=default,heavy
    --concurrency=1

# OK 2: the list form is the most explicit and safest
command:
  - celery
  - -A
  - app.celery_app:celery
  - worker
  - --loglevel=INFO
  - --queues=default,heavy
  - --concurrency=1
```

## How to avoid the same traps next time

- **When you see a multi-line `command:`**, check the container's actual CMD first (`docker inspect` / `docker compose config`). What YAML sent and what bash received can differ.
- **If you use `worker_hijack_root_logger=False`**, the `basicConfig` + `setup_logging` + `worker_process_init` set must come together. One call in the parent won't cover prefork children.
- **When you see an ERROR-only asymmetry**, use an active probe (force `logger.error` via a `delay()` on a non-existent id) to separate "not running" from "running but muted" first.

## What's next

- Make "two causes can hide behind one symptom" a debugging default. Even after fixing the first cause, re-check whether the symptom fully disappeared.

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
