---
title: "Three alarms, one root — a node host freeze that split three ways"
description: "Search down, metrics going backward, a node flapping — three alarms in different domains, one root: a node's host freeze. Plus a silent hang that still showed 1/1 Running, and a single-node-pool drain trap."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["kubernetes", "elasticsearch", "observability", "incident", "root-cause-analysis", "health-probes"]
category: "infra"
lang: "en"
translationKey: "host-freeze-three-alarms-one-root"
sourceIntake:
  - "docs/intake/from-infra/2026-05-29-host-freeze-three-alarms-one-root.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Three alarms in completely different domains fired at once — **search engine down, metric timestamps going backward (out-of-order), node readiness flapping.** The root was one: **a single node's host freeze.**
- When a host freezes, everything on it stops at once. Disk IO stalls so the search engine can't respond, CPU scheduling stalls so the node flaps between NotReady and Ready, and metrics burst out late so their timestamps go backward.
- Two hidden traps. ① **Without a probe, "can't respond" looks like "healthy"** — the process was alive, so it showed `1/1 Running` while actually hung. ② **Draining a single-role node pool leaves pods nowhere to go** — `nodeSelector` pointed only at that node, and there was only one, so drain turned everything into Pending.

> **Source note.** This post distills a top-level infra-team incident retrospective (`docs/intake/from-infra/2026-05-29-host-freeze-three-alarms-one-root.md`). Node / cluster / volume names, internal IPs, vendor, and node topology are generalized. The "single-node-pool SPOF" exposed in Trap 2 was later fixed by adding a node and spreading the load — and that fix hit another deploy trap, told in [The constraint that blocked the deploy](/en/blog/anti-affinity-deploy-order-trap-en/).

## Three alarms, three domains

Three alarms arrived almost simultaneously.

1. `ElasticSearchDown` — the search engine died
2. `PrometheusOutOfOrderTimestamps` — metric timestamps are going backward
3. Some node's readiness changed **6 times in 15 minutes** (flapping)

At first they looked separate. Search engine, metric collection, node state — different domains. Chase each and you get three branches of debugging. But one thing nagged. **All three fired at the same time, on the same node.**

## The root was one — a host freeze

I started with the node. Its resource requests were in normal range (no CPU/memory overload), yet the pods on it were restarting abnormally often. Reading the search engine logs directly was decisive — the **data-disk health check had stalled for 6 minutes, and a timer thread for 40 seconds.** Disk IO and CPU scheduling stopping at the same time — the textbook signature of a **host freeze.**

When a host (the node's hypervisor / hardware) freezes intermittently, everything on it stops at once. And that single stall splits into three symptoms.

- **Disk IO stalls** → the search engine can't read/write its data directory → delayed responses → monitoring flags it "down"
- **CPU scheduling stalls** → the search engine's timer stops for 40s, kubelet heartbeat lags → the node flaps NotReady↔Ready
- **kubelet/cadvisor stop and resume**, dumping metrics late → timestamps go backward → Prometheus rejects them as out-of-order

> **Lesson 1 — don't chase alarms by domain.** Search down, metrics broken, and node flapping look unrelated, but if they fired at the same time on the same node, suspect a common root (that node) first. Looking "node → workloads on it" explained all three at once.

## Trap 1 — without a probe, "can't respond" looks like "healthy"

A trap was hiding here. The search engine was effectively unresponsive from the disk IO hang, yet `kubectl get pod` showed a clean **`1/1 Running`**. The container process was alive.

Without readiness/liveness probes, Kubernetes treats **"the process is up" as "healthy."** It doesn't check whether requests are actually served. So diagnosis was only possible by **reading the application logs directly**, not the `kubectl` status. With a probe, the search engine would have dropped to `NotReady` automatically, cutting traffic and raising a clearer alarm sooner.

So the remediation added probes — but with the two roles separated.

```yaml
# readiness: a responsiveness check. On failure → NotReady, cutting traffic + alarming.
#            it asks "does it actually respond," not "is the process alive."
readinessProbe:
  httpGet: { path: /_cluster/health?local=true, port: 9200 }
  timeoutSeconds: 5
  failureThreshold: 3        # ~30s unresponsive → NotReady
# liveness: restart only at deadlock level. Set conservatively to avoid
#           an infinite restart loop on a host failure.
livenessProbe:
  httpGet: { path: /_cluster/health?local=true, port: 9200 }
  periodSeconds: 30
  failureThreshold: 6        # must be ~180s unresponsive to restart
```

Liveness is deliberately lax for a reason. **A host failure isn't fixed by restarting the container** — it just comes back on the same node. An aggressive liveness would spin an infinite restart loop the whole time the host is frozen. While readiness checks responsiveness and cuts traffic, liveness should react only to a *real* deadlock.

## Trap 2 — draining a single-node pool leaves pods nowhere to go

To recover, I cordoned the node and tried to drain its workloads onto a healthy node. But every evicted pod stuck at `Pending`. `NODE: <none>` — they wouldn't schedule at all.

The cause was topology. Those workloads pin to a **specific role's node** via `nodeSelector`, and that role had **only the one node I'd just cordoned.** Drain emptied it, but with no node to receive them, they hung in midair. The scheduler said exactly that.

```text
0/N nodes are available: 1 node(s) were unschedulable,
  M node(s) didn't match Pod's node affinity/selector.
```

> **Lesson 2 — `drain` is "evict," not "move."** If a role has only one node and there are `nodeSelector` workloads pinned to it, draining that node strands them. Before draining, check whether the workload has *another* node to go to. This is the structural SPOF of a single-role node pool, left as an availability follow-up — and the story of actually fixing it is in [another post](/en/blog/anti-affinity-deploy-order-trap-en/).

## Recovery

Since drain couldn't move them, I went the other way — **revive the node itself.** The host freeze might be transient (a noisy neighbor), so I rebooted the node. It came back Ready, and on uncordon the Pending workloads scheduled back onto it. The search engine restarted with a clean `started` in the logs and the disk-health warnings vanished — host recovery confirmed.

(A reboot may land on the same host, so if it recurs, swapping the node onto a fresh host is the next step. A 6-minute disk IO hang could be a transient load spike or a hardware signal — recurrence tells you which.)

## Takeaways

- **When alarms across domains fire together, suspect a common infra root first.** One node's host freeze can split into search, metrics, and node-state symptoms.
- **No probe = silent hang.** `1/1 Running` means "the process lives," not "it responds." Use readiness for responsiveness, liveness for deadlock.
- **Keep liveness conservative.** For failures restarting can't fix (like a host freeze), an aggressive liveness builds an infinite restart loop.
- **`drain` only "moves" pods when there's a node to receive them.** On a single-role node pool, drain just makes Pending — check the destination before draining.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
