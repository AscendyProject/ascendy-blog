---
title: "I set helm upgrade --timeout 10m — so why did it hang for 25 minutes?"
description: "A CI helm deploy hung 25 minutes and locked the release. Why didn’t --timeout 10m kill it? helm’s --timeout bounds only the wait/hook phase, not the apiserver hang before it. The real backstop was a CI job timeout."
pubDate: 2026-06-28
author: "Ascendy Engineering"
tags: ["kubernetes", "helm", "ci-cd", "github-actions", "self-healing", "timeout", "incident", "war-story"]
category: "infra"
lang: "en"
translationKey: "helm-timeout-apiserver-hang"
sourceIntake:
  - "docs/intake/from-infra/2026-06-17-helm-timeout-apiserver-hang.md"
draft: false
redactionReviewed: true
---

## TL;DR

- A CI (GitHub Actions) `helm upgrade` deploy **hung for 25 minutes with no logs** before being cancelled by hand. That left the Helm release `pending-upgrade` and **locked**, so every later deploy failed with *"another operation in progress."* A merged, approved change **didn't reach production for a day.**
- The first question was simple — **I'd set `helm upgrade --wait --timeout 10m`, so why didn't it die at 10 minutes instead of running 25?**
- The answer: helm's `--timeout` only bounds the **`--wait`/hook phase.** It does *not* bound the apiserver-call hang *before* it. The timer never even started.
- So the real backstop wasn't a helm flag — it was an **outer level** (a CI job timeout), and it only became self-healing once *paired* with a preflight that auto-rolls-back the pending release. (Bonus: that recovery script nearly killed itself during the very outage it was meant to fix.)

> **About this piece.** A real production-pipeline incident and its remediation (already merged). Cluster, release, and secret identifiers are generalized. The node-stability issue at the root is still under investigation, so I only go as far as *"the control plane was briefly degraded that day"* — this post is about *deploy-pipeline resilience,* not the node failure.

## A deploy stuck for 25 minutes

CI (GitHub Actions) deploys to a production Kubernetes cluster via `helm upgrade`. One day, a deploy run sat at **`in_progress` for 25 minutes with no output** before someone cancelled it. Two consequences followed.

First, a merged and approved change **didn't reach production for a day.** The image had been built and pushed to the registry, but the running image hadn't changed.

Second, worse. The Helm release was left in **`pending-upgrade`** and locked. Every deploy after it failed like this:

```text
Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress
```

Recovery meant a human typing `helm rollback`. The only guard we had until then was a concurrency group that **serialized** deploys — so two deploys couldn't touch the same release at once. But that only blocks *concurrency.* It does nothing about **one run hanging while holding the lock**, nor about **cleaning up the pending release a dead run leaves behind.**

## --timeout didn't wrap the phase I thought it did

So I re-read the docs. The question was singular — *"I clearly passed `--timeout 10m`, so why didn't it die at 10?"*

The answer was right there.

> helm's `--timeout` bounds only the **`--wait`/hook phase.** It does not bound the hang in the *earlier* phase — acquiring the release lock, calling the apiserver API.

That day, the cluster's control plane was briefly degraded. helm was stuck **before it ever entered `--wait`,** at the stage where it talks to the apiserver. So `--timeout 10m` never fires. *The timer never even started.*

Here's the first lesson. **Passing an application-level timeout does not guarantee "this operation finishes or dies within N minutes."** You have to check *which phase* that timeout actually wraps. The real backstop has to live outside it — at a level that can kill the process whole. For us that was the CI **job-level `timeout-minutes`.** It kills the process after a set time no matter what phase helm is stuck in.

## The real backstop had to be a *pair*

But the job timeout alone wasn't enough. When it kills the hung helm, the release is still *left* in `pending-*`. The lock doesn't release.

Surely `helm upgrade --atomic` handles this? No. **On a hard hang, helm never reaches its own rollback path.** `--atomic` works when helm is *alive to notice the failure* — not when the process is frozen and gets killed.

So I added two devices as a **pair.**

- The **job timeout** kills the hung helm → the release is left `pending-*`.
- A **preflight pending-recovery** step, at the start of the next run, auto-rolls-back that `pending-*` release to its last deployed revision (or, if there's no revision to roll back to, deletes the pending release secret). → the lock releases.

With only one, you get *"kills but doesn't clean up"* or *"nothing to clean up, so does nothing."* **Self-healing often requires a pair: the device that kills and the device that cleans up.** (To this I added helm's own `--atomic` and a rollout assertion that the dispatched image tag is actually the running image.)

## Two more traps the adversarial review caught

I ran this change through [adversarial code review](/en/blog/loop-engineering-verifier-en/), and two more things surfaced.

**(1) Version drift.** The reviewer noted: Helm 4 renamed `--atomic` to `--rollback-on-failure`, and `setup-helm` installs "latest stable." So *if CI silently jumps a helm major version one day,* the deploy command could break.

The reviewer asserted, firmly, that it would "fail at the parse stage." So I *actually ran helm* — and `--atomic` **still works in Helm 4 as a deprecated alias** (it just prints a warning and proceeds). "Parse failure" was an overstatement. But the *core concern was right*: **you must not let CI silently jump a tool's major version in a production deploy lane.** So instead of changing the deploy command, I **pinned the helm version** (behavior-preserving). The second lesson is both halves: pin tool versions to cheaply prevent "latest changed one day" incidents, and *verify deprecated-but-working aliases by actually running them* rather than trusting the docs or `--help` (a case where the reviewer's assertion proved overstated against a real run).

**(2) The recovery script self-destructs in the very situation it's meant to fix.** The preflight began like this:

```bash
set -euo pipefail
status="$(helm status <release> -o json 2>/dev/null | jq -r '.info.status // "absent"')"
```

The intent was *"if the release is absent, treat it as `absent` and just fall through to `upgrade --install`."* But `helm status` exits non-zero when the release is absent **or when the apiserver is degraded.** Under `set -euo pipefail` (especially `pipefail`), the whole step **dies right there** and never reaches `upgrade --install`. In exactly the apiserver-degraded situation this PR targets, the recovery destroys itself.

I wrapped the command substitution in an explicit `if/else`.

```bash
if status_json="$(helm status <release> -o json 2>/dev/null)"; then
  status="$(printf '%s' "$status_json" | jq -r '.info.status // "absent"')"
else
  status="absent"   # can't read it → "nothing to recover" → fall through to upgrade --install
fi
```

The third lesson. **Under `set -e`, don't drop a command that's allowed to fail into a bare command substitution.** Wrap it in a branch that *explicitly* permits failure — especially when that command is a diagnostic *designed to fail during an outage.*

## Takeaways

- **Check which phase an app-level timeout (`helm --timeout`) actually wraps.** The real backstop belongs at an outer level that can kill the process (here, a CI job timeout).
- **Self-healing is often a pair** — the device that kills (job timeout) and the device that cleans up (pending-rollback preflight). One alone is half a fix.
- **`set -euo pipefail` + command substitution + a command allowed to fail** is a trap. Wrap it in `if/else` to permit failure explicitly.
- **Pin your deploy tool versions in CI.** A "latest stable" major jump is prevented in one line.
- **Verify deprecated-but-working aliases by running them.** The docs' or `--help`'s assertion can differ from real behavior.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
