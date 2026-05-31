---
title: "Only one model kept 404'ing — a preview-alias time bomb meets branch asymmetry"
description: "In a multi-provider agent chat, one model path always 404'd. Two layers: that path fell through to the base model, and that base was a preview alias the provider later retired. A CI guard for model lifecycle."
pubDate: 2026-05-31
author: "Ascendy Engineering"
tags: ["llm", "model-lifecycle", "regression-testing", "incident-prevention", "multi-provider"]
category: "backend"
lang: "en"
translationKey: "preview-model-alias-timebomb"
sourceIntake:
  - "docs/intake/from-backend/2026-05-28-preview-model-alias-timebomb.md"
draft: false
redactionReviewed: true
---

## TL;DR

- In a multi-provider agent chat, **one model path always 404'd**. Every other model was fine.
- The cause wasn't one bug but **two layers**: ① branch asymmetry — that path alone fell through to the agent's **base model** with no explicit mapping; ② that base was a **preview alias**, and the provider retired it at the GA cutover, producing a 404.
- Three lessons: don't hardcode preview model ids / when "only one model breaks," suspect branch asymmetry / write regression tests as a "forbidden pattern," not a "pin to the right answer."

## Background — why does only one die

We had an agent chat that picks among several LLM providers. But selecting one specific model **always 404'd**, while the others worked fine.

"**Only one model fails**" is itself a strong clue. If the shared path (auth, network, request format) were broken, usually everything breaks. One breaking alone means that model takes a **different branch**.

## Cause 1 — branch asymmetry (fall-through)

The runtime model-selection middleware explicitly mapped a client only for *some* providers. The problematic provider had no mapping, so it returned `None` — which fell through, with no override, to the agent's **base model**.

```python
# Branch asymmetry: some providers explicitly mapped, the rest → None → base model
def _resolve_client(model_name: str):
    if model_name in PROVIDER_A_ALIASES:
        return client_a
    if model_name in PROVIDER_B_ALIASES:
        return client_b
    if model_name in PROVIDER_C_ALIASES:
        return client_c
    return None  # an unmapped provider → None → falls through to the agent's base model
```

The other providers were explicitly mapped, so they went safely to their own client. Only the one missing a mapping was exposed directly to the base model id — and that base id was the problem.

## Cause 2 — the base was a preview alias

The base model id the fall-through reached was pinned to a **preview alias**. Preview aliases can be deprecated and shut down on the provider's schedule (ours was retired after a GA successor shipped). Once shut down, calls to that id return `404 NOT_FOUND` ("no longer available").

In our case, the provider on that fall-through path was **Gemini**. A preview model was promoted to GA, the old preview alias disappeared ([model lifecycle is documented publicly](https://ai.google.dev/gemini-api/docs/models)), and that one path died with a 404. The preview id we'd hardcoded was a **time bomb**.

## The fix — a GA id + a regression guard

The immediate fix was a one-liner: replace the base with a GA id. On top of that, we swept the codebase and replaced models from a **soon-to-sunset generation** too.

The key part is the **regression guard** we added next. We did *not* pin "the currently correct model id" — that id will itself be retired someday, so pinning it makes the test break at every generation bump (brittle). Instead we check a **forbidden pattern**.

```python
# Regression guard: don't pin the right id, forbid the retire/preview pattern
for client in configured_model_clients:
    mid = model_id(client)
    assert "preview" not in mid          # forbid preview aliases that can be deprecated/shut down
    assert SUNSET_GENERATION not in mid  # forbid a soon-to-be-retired generation
```

Model ids are inherently perishable. This guard doesn't catch *every* perishable id — it blocks **known risky patterns** (preview aliases, a specific sunset generation) and complements the provider's lifecycle monitoring. Still, blocking that pattern without breaking on every generation bump beats pinning the exact answer.

## How to avoid the same trap next time

- **Don't hardcode preview model aliases.** They can be deprecated and shut down — track the provider's lifecycle schedule or add an expiry guard. Prefer a GA id when you can.
- **When "only one model breaks,"** suspect **branch asymmetry / fall-through**, not the shared path.
- **Guard external dependency lifecycles (models, endpoints) in CI**, but as a "forbidden pattern" (`-preview`, sunset generation), not a "pin to the right answer" — a low-brittleness guard suited to perishable identifiers.

## What's next

- Extend the same "forbidden pattern" guard beyond model ids to other externally-versioned identifiers (endpoint versions, deprecated parameters).

---

**Authorship & citation**: This post was written by Ascendy Engineering and may be re-cited with attribution. If you find an error, please let us know via a GitHub issue.
