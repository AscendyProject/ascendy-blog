---
title: "Why we didn't delete duplicate workload definitions in one PR — a phased transition"
description: "The same workloads lived in two places — raw manifests and a Helm chart. Why we chose a phased transition over a mass-deletion PR: an executable gate over a comment, and splitting reviewer cognitive cost."
pubDate: 2026-05-28
author: "Ascendy Engineering"
tags: ["kubernetes", "helm", "migration", "decision-making", "risk-management"]
category: "infra"
lang: "en"
translationKey: "k8s-helm-transition-decision"
sourceIntake:
  - "docs/intake/from-infra/2026-05-27-k8s-helm-overlap-transition.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 12 production workloads were **defined in two places** — raw Kubernetes manifests and a Helm chart. We had to consolidate to a single source of truth.
- Instead of **deleting everything in one PR (A)**, we chose a **phased transition (C)**: declare Helm authoritative now, but defer the actual deletion to a follow-up PR.
- Two decisive reasons: ① "do not use this" **can't be enforced by a comment — you need an executable gate**, and ② the blast radius of a mass deletion exceeded **a single reviewer's cognitive limit**.

## Background — one workload, two definitions

12 workloads were defined in both raw Kubernetes manifests and Helm chart templates at the same time. The active deployment (CD) path was Helm alone, but the problem was a legacy deploy script. It had a second path that **mutated the live Deployment directly** via `kubectl set image`. That path operates **outside** the Helm release lifecycle, so it could drift the recorded release state away from the cluster's actual state.

## Three options

- **A.** Declare Helm authoritative and **delete the 12 raw manifests in one PR**. Remove the direct-mutation path too.
- **B.** Declare the raw manifests authoritative and demote Helm to a support role.
- **C.** Declare Helm authoritative, but mark the raw manifests with a `DO NOT DEPLOY` header and put a **hard gate** on the legacy script's direct-mutation path. Defer the actual deletion to a follow-up PR (Phase 2).

**B dropped out quickly.** Every piece of incident hardening accumulated in the chart over the last quarter — an image-tag guard, a migration hook, a post-deploy smoke test, a registry-secret check — depends on Helm hook annotations and `--reuse-values` / `required` semantics. Re-implementing those as vanilla manifests is impossible. Choosing B would make "raw is the single source" a false promise, because the chart has to ship anyway.

## A vs C — cleanliness is bought with reviewer cognitive cost

A ends the confusion of two trees on disk **immediately**. But it asks one PR to review a 12-file deletion plus the script deprecation. The reviewer has to confirm that all 12 files really aren't referenced anywhere, while also following the script deprecation.

The two decisive reasons for C:

**1. A hard gate can't be a comment.** A `DO NOT DEPLOY` header is only visible if a reader *opens* the file. But the direct-mutation call inside the script runs even if no one opens the file. So we added a **gate that blocks at execution time** — it only proceeds if there's an explicit ack via an environment variable **or** a flag (OR semantics). Requiring both would make the bypass so heavy it loses its meaning as an incident-time escape hatch.

```bash
# Legacy path: refuse to run unless one ack (env var or flag) is present.
BYPASS="${BYPASS:-0}"
for arg in "$@"; do
  case "$arg" in --acknowledge-bypass) BYPASS=1 ;; esac
done
if [ "$BYPASS" != "1" ]; then
  echo "ERROR: Helm is authoritative. This legacy path needs an explicit ack:" >&2
  echo "  BYPASS=1 or --acknowledge-bypass." >&2
  exit 1
fi
echo "WARN: legacy bypass path triggered — is this intentional?" >&2
```

**2. A mass deletion's blast radius exceeds a reviewer's cognitive limit.** Some of the 12 files might be referenced elsewhere, some might not. Verifying every reference in one PR while also tracking the script deprecation asks too many simultaneous checks of one person. If we lay down the gate in Phase 1, observe how often it triggers, and use that data to do the real deletion in Phase 2, the second PR becomes **"delete code we've confirmed is unused."** That's a different review burden.

## Decision / tradeoffs

A is cleaner. But **cleanliness is bought with reviewer cognitive cost.** Splitting into Phase 1 → Phase 2 is an explicit choice to pay that cost in two installments. The downside, honestly: two trees coexisting on disk is itself confusing to newcomers, and a header comment is just the first line of a grep result, not enforcement. That's why enforcement is the gate's job, not the comment's.

## What's next

- Phase 2: delete the raw manifests for real after observing gate-trigger frequency.
- See: [Helm Hooks](https://helm.sh/docs/topics/charts_hooks/), [`helm upgrade --reuse-values`](https://helm.sh/docs/helm/helm_upgrade/).

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
