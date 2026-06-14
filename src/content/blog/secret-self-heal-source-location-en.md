---
title: "What mattered in self-healing a secret wasn't the tool — it was where the loop runs"
description: "Self-healing a deletable pull-secret, I almost reached for the heavy 'proper' answer. One question — 'why not a CI secret?' — flipped it. What mattered wasn't the tool, but where the source and reconcile engine run."
pubDate: 2026-06-13
author: "Ascendy Engineering"
tags: ["kubernetes", "secrets", "self-healing", "design-decision", "over-engineering", "war-story"]
category: "infra"
lang: "en"
translationKey: "secret-self-heal-source-location"
sourceIntake:
  - "docs/intake/from-infra/2026-06-13-secret-self-heal-source-location.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Using private images, a cluster needs a registry-login **pull-secret**. When it's created **outside the Helm chart**, the chart doesn't *own* it — so if someone deletes it out-of-band, **the chart won't bring it back.** → `ImagePullBackOff`. So **self-healing** it becomes the task.
- I nearly reached straight for the "proper platform answer" — **External Secrets Operator (ESO) + a cloud Secrets Manager**. Then the operator asked one thing: **"why not just a CI secret?"** — and it flipped the design.
- The realization: **the decisive property wasn't the tool's sophistication, but whether the *source and the reconcile engine both live outside the cluster*.** A CI push model achieved that — with no new components, no bootstrap credential, reusing the existing deploy pipeline — more simply than ESO.
- But robustness ≠ immunity. So we scoped it to *this one secret* and bolted on a **detection alarm as the backstop**.

> **Source note.** Distilled from an infra-team intake. The triggering incident's specifics and any open operational follow-up are excluded (Class A); cluster, registry, and CI identifiers are anonymized — the post stays at the general design-decision level. Same infra decision/war-story vein as [the constraint that blocked the deploy](/en/blog/anti-affinity-deploy-order-trap-en/) and [three alarms, one root](/en/blog/host-freeze-three-alarms-one-root-en/).

## A secret the chart didn't make, the chart won't fix

With private container images, the cluster needs a **pull-secret** (Kubernetes `imagePullSecrets`, type `dockerconfigjson`) to pull from the registry. And that secret is often created **outside the Helm chart**, not by it.

Which means — **the chart doesn't own that object.** A cleanup script, a namespace operation, human error… for whatever reason it disappears *out-of-band*, and re-running `helm upgrade` **won't recreate it.** It didn't make it. And the next image pull or pod restart breaks with `ImagePullBackOff`.

So the task was clear: **self-heal this secret.** The interesting part was *how*.

## I almost reached straight for "the proper answer"

At first I went, without hesitation, for "the platform-engineering correct answer" — **External Secrets Operator (ESO) + a cloud Secrets Manager.** Keep the secret's truth in a store outside the cluster, with an in-cluster controller continuously reconciling it. A clean, standard picture.

Right before implementing, the operator asked:

> **"Why even use that? Why not just a CI secret?"**

That one question stopped the design. And re-examining it, the simpler side was right.

## What mattered was 'where the source and engine live,' not the tool

The core threat here was that **"you may not know who deleted it."** Out-of-band deletion has many sources, so "find who deleted it and stop them" isn't enough — it has to **auto-recover no matter who deletes it.**

Which leads straight to: ***where does the recovery source (the source of truth) live?*** If it's *inside* the cluster, a single in-cluster deletion can take the source out with it.

Through that lens, the two options:

```text
[ESO]  external store ──(pull)──▶ [in-cluster: operator + CRD + RBAC + bootstrap cred] ──▶ Secret
                                  ^^^^^^^ reconcile engine inside the cluster ^^^^^^^
[CI]   CI secret ──(workflow reads it · outside the cluster)──(push: kubectl apply)──▶ Secret
       ^^^ source outside ^^^        ^^^ engine outside too ^^^
```

- **ESO (pull model)** — the source is outside (good). But the reconcile *machine* — operator, CRDs, RBAC, and the **bootstrap credential** to reach that external store — still lives *inside* the cluster. That bootstrap credential is itself a deletable in-cluster object. *A smaller but real* chicken-and-egg.
- **CI push model** — put the login in a CI (e.g., GitHub Actions) secret, have the **workflow read it** and recreate the secret via `kubectl apply` right before deploy. **Source outside, reconcile engine (the CI runner) outside too.**

Then one technical constraint settled it: **GitHub Actions secrets have no API to read their value** — the value is exposed *only inside a workflow run*. So you can't use one as ESO's *pull* backend at all. "Wire a GitHub secret into ESO" doesn't even hold; only **"a workflow receives the secret and pushes it to the cluster"** does.

The conclusion was surprisingly clear. **CI push was one face simpler — and stronger — than ESO.** It gives the same core property (source outside), keeps the **reconcile engine outside too**, **reuses the existing deploy workflow + cluster credentials** so almost no new surface is added, and there's **no bootstrap chicken-and-egg.**

It was a case where "the answer that fits the problem" beat "the heavy correct answer."

## Still — don't go too far

A key discipline came out of the CD review: **don't extend this push model to *every* secret.**

Start pushing all your app/runtime secrets through the workflow, and CI bloats into a secrets-management *platform*, with access, audit, and rotation scattered everywhere. So we adopted push **only for the self-heal of this one pull-secret**, and left ESO as a *deferred — not discarded* — option for "when the need to manage many secrets together actually grows." We didn't reject the tool; we honestly drew its scope.

## robustness ≠ immunity

The push model isn't "set and forget" either. If the CI runner, the cluster credentials, or the workflow itself break, the self-heal stops too. So the precise framing is **"*separate* the source of truth from the cluster's deletion domain,"** not "make it undeletable."

That's why the design makes a **detection alarm mandatory** — if the secret is missing, alert *immediately* rather than waiting for the next deploy. **Auto-recovery is the first line; the detection alarm is the backstop.** (In the implementation, the value never leaks to logs or argv: env → temp file (`umask 077`) → `--from-file`, apply output suppressed, and a `trap` that removes the temp file even on failure — small things adding up to safety.)

## Takeaways

- **A k8s Secret the chart didn't make, the chart won't fix.** Secrets created outside the chart are defenseless against out-of-band deletion — design the self-heal *explicitly*.
- **A decision frame for self-healing:** when the threat is "you don't know who deleted it," the decisive thing isn't the *tool* — it's ***where the recovery source and the reconcile engine run***. Both should be outside the cluster.
- **"The proper platform answer" isn't always the right one.** ESO's reconcile engine stays inside the cluster and creates a bootstrap chicken-and-egg. CI push reused existing deploy credentials and avoided it — *for this problem*, simpler was stronger.
- **Don't let "simpler" sprawl.** Scope it to one secret, and reach for the heavy tool when the need to consolidate genuinely grows. And **robustness ≠ immunity** — put a detection alarm next to your auto-recovery as a backstop.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
