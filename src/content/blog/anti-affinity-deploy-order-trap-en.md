---
title: "The constraint that blocked the deploy — required anti-affinity and the missing second node"
description: "To break a SPOF we added 'required' anti-affinity — but no node could satisfy it yet. An unrelated team's CD stalled 25 hours; helm failed 5 times. A spread constraint before the room to spread blocks the deploy."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["kubernetes", "helm", "pod-anti-affinity", "continuous-deployment", "deploy-order", "root-cause-analysis"]
category: "infra"
lang: "en"
translationKey: "anti-affinity-deploy-order-trap"
sourceIntake:
  - "docs/intake/from-infra/2026-06-03-anti-affinity-deploy-order-trap.md"
draft: false
redactionReviewed: true
---

## TL;DR

- To break a single-point-of-failure where everything sat on one node, we put **`required` podAntiAffinity** on two heavy stateful workloads (a search engine and a graph DB) to force them onto separate nodes.
- But the **second node to satisfy that constraint didn't exist yet.** The graph DB had nowhere to go → Pending → readiness never met → **an unrelated team's CD stalled for 25 hours and helm failed 5 times in a row.**
- The point: **a `required` constraint needs the capacity to satisfy it to exist *first*.** Place a spread constraint before the room to spread, and the constraint becomes "unschedulable" and blocks the deploy. On a shared release, the damage spreads to an unrelated team.
- Bonus lesson: the step the runbook flagged as "most dangerous" — moving the broker — had already been *neutralized* by the failed deploy partially applying it. **Before running a dangerous step, re-verify on current state whether the danger still applies.**

> **Source note.** This post distills a top-level infra-team intake (`docs/intake/from-infra/2026-06-03-anti-affinity-deploy-order-trap.md`). Node / workload / release names, image tags, vendor, and the CD trigger implementation are generalized. An earlier host-failure retrospective had left "a single-role node pool means there's nowhere to drain to" as a SPOF follow-up; this is the record of a trap hit while actually fixing that SPOF.

## Trying to break a SPOF — five failed releases

The data plane (search, graph, cache/broker) all sat on one node. If that node froze, they all died together — a single point of failure. The plan was simple: **add one node**, and put `required` anti-affinity on the two heavy stateful workloads to **force them apart onto different nodes.** The chart change was merged ahead via a PR.

But the applied state looked wrong. The **helm release was `failed`, and the same upgrade had failed 5 times in a row over the previous day** — all with the same message.

```text
Deployment/<graphDB> not ready: Progress deadline exceeded
```

## Why — there was no node to satisfy the constraint

Those 5 failures were actually **an unrelated team's CD**, nothing to do with the SPOF fix. Our CD works like this: an app repo builds, fires a deploy event to infra, and infra runs `helm upgrade` to swap just that image tag. But that upgrade **re-applies the entire chart**. So the merged SPOF fix (`required` anti-affinity) got **dragged in and applied alongside** that deploy.

The problem was timing. The anti-affinity says "don't put the search engine and graph DB on the same node," but at that moment **there was only one node of that role**, and the search engine was already on it. So the graph DB had **nowhere to go and stuck at Pending** → readiness never came → `Progress deadline exceeded` → upgrade failed. Five times, and the release froze at `failed`.

Here's where the trap turns cruel. The victim was **another team's deploy** that had never touched the SPOF. That team spent **25 hours** wondering "why won't my deploy go through?" — and the cause was an entirely different infra change. The one missing premise: a **second node**.

> **Order is everything.** A `required` constraint needs the capacity to satisfy it *first*. Place a spread constraint before the room to spread, and it flips to "unschedulable" and blocks the deploy. And when many pipelines share one release, **one change's failure holds an unrelated deploy hostage.**

## Trap 2 — the "most dangerous step" had already passed

The runbook flagged moving the cache/broker (a Celery broker with no persistent volume) as the **most dangerous step**. Moving it recreates the pod and loses queued or in-flight broker state. So we prepared the careful dance: stop the scheduler → drain the queue → move → recover.

But the actual state told a different story — **the broker had already been running on the app node for 25 hours.** Yesterday's failed upgrades had ultimately failed at graph-DB readiness, but the **broker Deployment patch had already been partially applied** before that, and the broker had long since moved. The dangerous cutover the runbook feared was **already (accidentally) done**, and re-applying the same chart wouldn't move the broker — no queue flush.

How did we confirm this before touching anything? **We diffed the currently deployed manifest against a freshly rendered one.**

```bash
diff <(helm get manifest <release> -n <ns>) \
     <(helm template <release> ./chart -n <ns> -f values.yaml --set <tags>)
```

The stateful and broker pod templates showed **zero changes**. So we *predicted* "re-applying won't change the templates, so no recreation," and ran it. The result was a clean reconcile — adding the second node finally let the graph DB schedule, and one `helm upgrade` brought the release from `failed → deployed`. After applying, every stateful pod's AGE and restart count were unchanged = **zero recreation.**

> Before running a dangerous step, **re-verify on current state whether the danger still applies.** The runbook assumed "the broker needs to move," but a partially-applied failed deploy had already invalidated that premise. **The manifest diff is a prediction; the post-apply AGE/RESTARTS is the confirmation.** A diff only shows the absence of template changes — it doesn't guarantee hooks, external changes, or runtime failures, so confirming zero-downtime is always a post-apply metric.

## Trap 3 — `--reuse-values` almost dragged the stuck deploy along

When you reconcile, helm offers `--reuse-values` (reuse the previous release's values). Looks convenient. But the previous "values" were **the new image tag that failed deploy was trying to ship**. Had we run with `--reuse-values`, a job meant only to clean up the release state would have **carried an unrelated version change as a side effect**.

So deliberately, instead of `--reuse-values`, we **pinned the current live tag with `--set`**, confining the reconcile to a pure "state cleanup." The blocked new version wasn't for infra to push by hand — it was **for that app's CD to fire again** (now succeeding, with the SPOF resolved), so we handed it back to that lane.

## Takeaways

- **Capacity first, constraint second.** A `required` spread constraint needs the node to spread onto to exist first. Wrong order, and the constraint blocks the deploy.
- **A shared helm release is a stage for cross-team hostage-taking.** When pipelines share one release, one change's failure stalls an unrelated team's deploy — and you can't even see where the failure came from.
- **Re-verify a dangerous runbook step against current state before running it.** A partially-applied failed deploy may have already neutralized the "danger." **Diff is prediction, post-apply metrics are confirmation** — different jobs.
- **`--reuse-values` drags in the last failed deploy's values.** Confine a state cleanup by pinning live values explicitly.
- And a limit — spreading reduces the *blast radius* of a single node failure; it doesn't prevent the failure itself. Blast-radius and freeze-frequency are different problems.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
