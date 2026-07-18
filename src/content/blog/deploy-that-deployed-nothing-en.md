---
title: "The deployment succeeded and deployed nothing — a mutable tag swallowed the rollout"
description: "The deploy said success, rollout said complete, the safety net went green — yet production didn't change. Mutable tag (latest): same name, new content, so Kubernetes saw 'no change,' and the safety net passed vacuously."
pubDate: 2026-07-19
author: "Ascendy Engineering"
tags: ["infra", "kubernetes", "helm", "ci-cd", "mutable-tags", "postmortem"]
category: "infra"
lang: "en"
translationKey: "deploy-that-deployed-nothing"
sourceIntake:
  - "docs/intake/from-infra/2026-07-16-deploy-that-deployed-nothing.md"
draft: false
redactionReviewed: true
---

## TL;DR

- I pushed the operator-gated deploy button to ship frontend changes to production. The workflow finished **success,** `rollout status` said **complete,** and the post-deploy safety-net check **passed.** Three green lights — and **production was still the old version.**
- The culprit was the **mutable tag (`latest`)** used for deploys. This deploy was `latest`, the last one was `latest` too → the pod spec helm rendered was *not one character different* from before. Kubernetes saw "no change" and started no new pods. **helm success ≠ a rollout happened.**
- Worse, the very safety net built to catch this kind of silent non-deploy *passed vacuously.* It grepped "does the running image contain the tag we just deployed" — and with tag `latest`, that's always true, even when the rollout was zero.
- Two lessons: **(1) a tag whose name stays the same while its content changes gets judged by an orchestrator on the name alone; (2) the validity of a defense depended on the very property that defense was meant to protect.**

> **About this piece.** An infra war story. It's a post-mortem of an *already-closed* trap (a guard that rejects mutable tags at the door has shipped, so this silent-no-op class is closed), and it has nothing to do with credentials. Tool names like Kubernetes and helm are kept; internal identifiers (registry paths, cluster, namespace, release, workflow names) are generalized.

## The symptom — a successful deploy, an unchanged production

To ship several frontend changes to production, I pressed the deploy button that only runs when an operator triggers it. The deploy workflow finished **completed / success.**

But a hard refresh, and an incognito window, both showed the old version in the production web UI. None of the several merged changes were reflected. *Not one.*

Scanning the logs, no step had failed. If anything, the opposite: there were *three* signals all pointing at success.

## Three green lights, all true

What made this hardest to debug wasn't that something was *red.* It was that **three green lights were on, and none of them was lying.**

1. **helm returned "upgrade succeeded."**
2. **`kubectl rollout status` returned "already complete."**
3. **The post-deploy safety-net check passed** — a step that verifies "does the currently running image contain the tag we just deployed?"

All three were true. And all three were *consistent* with "production didn't change." That's the core difficulty here — when several success signals **share the same blind spot,** that spot is caught by none of them.

## Root cause — mutable tag + identical render = zero rollout

The deploy command looked roughly like this.

```bash
# Every deploy passes the same mutable tag.
helm upgrade --install <release> ./chart \
  --reuse-values \
  --set frontend.image.tag=latest    # <- last time latest, this time latest
```

`--reuse-values` inherits the previous release's values and overrides only this tag with `--set`. But the overridden value (`latest`) equaled the previous one (`latest`). So **the pod spec helm rendered was identical to the previous release** — the image reference was `.../frontend:latest`, not one character different.

Here's the common misconception to name. helm *does* create a new release revision. **But that is not a rollout.** What triggers a rollout is not helm but Kubernetes' **Deployment controller,** and the controller makes a new ReplicaSet only when it detects a change in the pod template. If the rendered pod spec is identical to before, the controller has *nothing to do.* No new ReplicaSet, no new pods, no new image pull. The node keeps serving the old `latest` image it already cached.

So helm returns "success" and `rollout status` returns "already complete." **Both are true.** Neither contradicts production not changing.

And here the mutable-tag trap completes. The *name* `latest` stays the same, but the *content* it points to (the image digest) changes with every build. Yet helm and Kubernetes compare only the tag **string,** not whether that string now points to a new digest in the registry. **Same name → judged "no change."**

## The second layer — why the safety net passed vacuously

This pipeline had a check built *precisely* to catch this kind of silent non-deploy. The logic was simple.

```bash
# After deploy: does the running image contain the tag we just deployed?
live=$(kubectl get deployment frontend -o jsonpath='{..image}')  # -> .../frontend:latest
echo "$live" | grep -q -- "$TAG"    # TAG=latest -> always matches
```

Read the running image reference after the deploy, and grep whether the tag string you just dispatched is in it. If not, fail. Sounds reasonable.

But with tag `latest`, this check is **always true.** The running (old) image is `.../frontend:latest`, the dispatched tag is `latest` — grep matches. **It matches even when no rollout happened at all.**

This is the part most worth chewing on. **In exactly the failure mode the safety net was meant to catch, the safety net itself was neutralized.** For this check to mean anything, the tag has to be unique per deploy — that is, *immutable.* With a sha tag, the old pod would carry the old sha and the new deploy the new sha, so the grep would become a real assertion.

In one line: **the validity of the defense depended on the very property (tag immutability) that defense was meant to protect.** When that property broke, the defense broke with it — silently. That's why all three green lights were true: all three looked only at the tag string, and all three were blind in the same place.

## One wrong answer while choosing a mechanism

The first candidate for a fix was "detect after the deploy whether a rollout *actually* happened" — check whether the Deployment's generation bumped, whether a new ReplicaSet appeared.

But this has a **false positive.** When you *intentionally* redeploy the same sha (say, a retry after a transient failure), the pod spec doesn't change, so generation doesn't bump — and that's *normal* (the correct image is already running). To distinguish a "good no-op (re-applying the same content)" from a "bad no-op (a mutable tag hiding new content)," you ultimately **need the signal of the tag's mutability.** Generation alone can't tell them apart.

Comparing registry digests directly is robust for any tag, but it requires registry authentication on the deploy runner (a new secret surface), which was too much for a defense-in-depth check.

So the final choice was the simpler one — **reject mutable tags at the dispatch stage, at the door.**

```bash
case "$TAG" in
  latest|main|stable|edge)
    echo "❌ Rejecting mutable tag '$TAG': it causes silent no-op rollouts."
    echo "   Dispatch with an immutable tag (e.g. sha-<short-sha>)."
    exit 1
    ;;
esac
```

This has zero false positives, zero new secrets, and it *forces* the "use immutable tags" recommended flow through the pipeline. When rejected, the deploy fails **loudly,** and the error message points at the exact fix (dispatch with a sha tag). As a side effect, the grep safety net above becomes a real assertion again — because the tag is now immutable.

A silent non-deploy is always worse than a loud rejection at the door.

## Takeaways

- **helm success is not a rollout.** What triggers a rollout is the Deployment controller, not helm, and the controller looks only at *string* changes in the pod template. Same tag name → "no change," even if the digest changed.
- **A mutable tag (`latest`) is a fixed name over fluid content.** The orchestrator compares only the name. This is the root reason CD guidance prefers immutable per-commit (`sha-<short>`) or digest deploys.
- **A defense's validity must not depend on the property it protects.** A tag-based safety net is valid only if the tag is immutable — but the very failure it guards against breaks that immutability.
- **Block at the source, not detect after.** Generation detection false-positives on normal redeploys. To catch the bad no-op you ultimately need the tag-mutability signal, so rejecting mutable tags at the door is simpler and false-positive-free. **Fail loud, not silent.**

A non-deploy dressed as success costs far more than an explicit failure. This incident — three green lights all true, only the result wrong — made us pay that price in full.

## References

- [Kubernetes — container images and `imagePullPolicy`](https://kubernetes.io/docs/concepts/containers/images/)
- [Kubernetes — updating a Deployment (a rollout triggers only on a pod-template change)](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Helm — `helm upgrade` and `--reuse-values`](https://helm.sh/docs/helm/helm_upgrade/)

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
