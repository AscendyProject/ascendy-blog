---
title: "One GPU should be enough, right? — A self-hosted AI inference war story, part 1"
description: "Moving image-preprocessing inference from an external API to self-hosted GPUs and back to managed GPU: single-GPU OOM, CPU-offload latency, a two-GPU split, and the hidden cost of self-hosting GPU inference."
pubDate: 2026-05-30
author: "Ascendy Engineering"
tags: ["gpu", "inference", "triton", "vllm", "cost-optimization", "oom", "self-hosting", "war-story"]
category: "infra"
lang: "en"
translationKey: "ai-serving-evolution-part1"
sourceIntake:
  - "docs/intake/from-infra/2026-05-28-ai-serving-evolution-part1.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We moved image-preprocessing AI (captioning, tagging, face recognition, embeddings) through four stages: **external multimodal API → self-hosted GPU serving → managed GPU**.
- Each stage was **a new problem created by the previous stage's fix**: the API broke at batch scale → putting everything on one GPU caused OOM → offloading embeddings to CPU collapsed throughput → adding a second GPU brought vLLM OOM plus fixed cost.
- Two key lessons: ① **a cloud LLM API's unit economics are a different function at demo scale than at production scale.** ② **the break-even for self-hosting GPU inference has hidden costs** — engineering time spent tuning OOM + always-on fixed cost + operational complexity.

> **Source note.** This timeline's primary source is operational memory and console history. The intermediate stages (single GPU → CPU offload → two GPUs) were squashed into single commits and don't survive cleanly in git. We mark which parts the code proves and which rest on memory.

## Background — what worked at one or two photos

We built a feature where uploading a photo lets AI organize it for you. For each photo it writes a caption, tags it, finds faces, and produces a search embedding. The first implementation took the fastest path — send the photo to an **external multimodal LLM API** and get a description back. Tested with one or two photos, it was fast and accurate. We thought we were done.

We'd missed one thing. Our service is fundamentally **album-scale**. Users don't upload one photo at a time — they upload 100 at once.

## Stage 1 — the cloud API broke at batch scale

Once photos came in batches of 100, two things blew up at the same time — **latency and cost**. Per-call billing and per-call latency both accumulate linearly with batch size. A constant that was harmless at one or two photos, multiplied by 100, swelled into something large enough to threaten the viability of the service itself.

This wasn't a tuning problem. The **structure** of "one external API call per image" simply didn't fit a batch workload. We needed a structural replacement, not an optimization.

> **Lesson 1.** A cloud LLM API's unit economics are a different function at demo scale than at production scale. "Works" at one or two photos predicts nothing about "is viable" at 100. For a workload where per-call cost and latency multiply, demo success can be a false signal.

So we decided to bring inference in-house. Self-hosted GPU serving.

## Stage 2 — putting everything on one GPU caused OOM

We pivoted to self-hosting and put every model on **a single high-end GPU** with [Triton Inference Server](https://github.com/triton-inference-server/server). The model stack was five kinds:

- a text embedding model (multilingual)
- a reranker
- a vision encoder (image–text alignment)
- a face detector + face embedding (a two-stage pipeline)
- a VLM (vision-language instruction model)

One card would be enough, right? (The title already spoils that.) Loading all of them on one card produced **constant OOM**. The culprit was clear: the VLM eats most of the VRAM, and keeping the embedding models resident on top of it didn't fit in memory.

The mitigation was intuitive — **we moved the embeddings and reranker from GPU to CPU.** Those two are smaller than the VLM and do run on CPU. To relieve the VRAM pressure, we moved the lightest models to CPU.

> **Source note (memory-based).** The current code doesn't prove this CPU-offload stage. The models we'd moved to CPU were later removed from the model repo when we changed the architecture again, and every model config that remains today is GPU-served. So this stage rests on memory — squashed commits plus later model removal mean it doesn't survive in git.

In Triton, moving a model to CPU means changing the `kind` of its `instance_group`:

```text
# To dodge GPU OOM, move an embedding model to CPU.
# VRAM frees up, but you pay for it in throughput.
instance_group { kind: KIND_CPU, count: N }   # for GPU serving: kind: KIND_GPU

# (Illustrative — our current model repo has no KIND_CPU entries. The models
#  we moved to CPU were later removed. The above is just a generic example of
#  "what the config looks like during a GPU→CPU offload.")
```

## Stage 3 — CPU offload created latency this time

Memory was freed. But this time the embeddings got too slow.

The core of an embedding workload is **batch throughput**. For a 100-photo album you have to produce hundreds of vectors at once. Moving that to CPU collapsed the throughput. We'd traded a memory problem for a latency problem.

> **Lesson 2.** CPU offload buys you VRAM but you pay in throughput. Move a throughput-critical workload to CPU — even a small model, even something like embeddings that runs in batches — and you just shift OOM into latency; the problem doesn't disappear.

So we added GPUs. Instead of one high-end GPU, we went to a **two mid-tier GPU** layout:

- **GPU A** — Triton for everything except the VLM (embeddings back on GPU, the face pipeline, the vision encoder)
- **GPU B** — the VLM served separately with [vLLM](https://docs.vllm.ai/)

The reason we split out only the VLM to vLLM is that vLLM does memory and batching management specialized for LLM/VLM inference (paged attention, continuous batching) better than Triton's generic Python backend. Trying to handle everything from embeddings to a generative VLM on a single generic multi-model server was itself the overreach.

## Stage 4 — vLLM OOM'd too, and then there was fixed cost

We split them. But the vLLM side **OOM'd and was unstable again**. A VLM's KV cache grows with context length and the number of concurrent sequences during inference. We had to keep tightening the memory knobs.

```bash
# OOM-defense tuning when serving a VLM separately with vLLM.
# We started aggressive (high utilization, long context) and the knob
# values carry the scar of being walked back to conservative after OOM.
# (Below are placeholders — the direction matters more than the actual values:
#  aggressive → conservative.)
python3 -m vllm.entrypoints.openai.api_server \
    --model <model-path> \
    --gpu-memory-utilization <high→lower> \
    --max-model-len <long→shorter> \
    --dtype bfloat16 \
    --max-num-seqs <seq-limit> \
    --enable-chunked-prefill
# --gpu-memory-utilization : lower utilization to leave OOM headroom
# --max-model-len          : shorten context to cap the KV cache
# --max-num-seqs           : limit concurrent sequences (backpressure)
# --enable-chunked-prefill : split long prefills to defend against fragmentation
```

> **Code trace.** The now-parked vLLM config still carries this tuning's marks. `--gpu-memory-utilization` and `--max-model-len` are split between an aggressive script default and a conservative override — the scar of starting aggressive and being walked back conservative after OOM.

And on top of this came **fixed cost**. A self-managed cluster's GPU nodes are always-on. Even with no traffic, two GPUs bill by the hour. Add the operational burden of multi-model serving — OOM tuning, model loading, node-failure response — to always-on fixed cost, and the original assumption that "self-hosting is cheaper than the cloud API" started to wobble.

## Decision / tradeoffs

What started as "one GPU should be enough" at demo time sprawled into two GPUs + a vLLM split + endless memory tuning. At that point we decided to **retreat to managed GPU**. (That migration is [part 2](/en/blog/ai-serving-evolution-part2-en/).)

The honest point here is that the break-even for self-hosting GPU inference is not the simple "API per-call cost vs. GPU hourly cost" comparison people usually reach for. That equation leaves out three hidden costs:

1. **Engineering time spent tuning OOM** — the human hours spent fitting memory knobs, shuffling CPU/GPU placement, and splitting models.
2. **Always-on fixed cost** — GPU nodes bill by the hour regardless of traffic. For a service with spiky load, this cost is large.
3. **Operational complexity** — in multi-model serving, when one model dies the others are affected too, and the node-failure surface is wide.

Put those three into the equation and, at our scale and traffic pattern, managed GPU was the better choice. It's not that self-hosting is always wrong — it's that **if you look only at the hourly rate when computing break-even, you get the wrong answer.**

## What's next

- **[Part 2](/en/blog/ai-serving-evolution-part2-en/)**: the managed-GPU migration — what got simpler, and what we gave up.
- See: [vLLM engine args](https://docs.vllm.ai/en/latest/models/engine_args.html), [vLLM chunked prefill](https://docs.vllm.ai/en/latest/performance/optimization.html), [Triton `instance_group`](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/model_configuration.md#instance-groups).

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
