---
title: "Why you can't trust an AI-written portfolio — making 'never invented' a structural guarantee, not a hope"
description: "AI résumé generators are easy to build, hard to trust — they exaggerate and hallucinate. portfolio inverts it: pin evidence first via gh, let the model narrate atop it, and a grounding gate rejects untraceable claims."
pubDate: 2026-06-16
author: "Ascendy Engineering"
tags: ["grounding", "ai", "portfolio", "developer-tools", "harness", "trust"]
category: "meta"
lang: "en"
translationKey: "portfolio-harness-launch"
sourceIntake:
  - "docs/intake/from-portfolio/2026-06-16-portfolio-harness-intro.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We're open-sourcing **portfolio** (v0.0.1, Apache-2.0). It turns a developer's real GitHub work into a **grounded portfolio** — *every claim traced to evidence, never invented.*
- The real problem with AI portfolio/résumé generators isn't quality, it's **trust**. They exaggerate, hallucinate, and stuff keywords. portfolio **inverts the trust model.**
- The usual flow is "the model generates → you hope it's true." Here, **evidence is pinned first, deterministically** (`gh` pulls your actual merged PRs and changed files), and the model narrates only on top of it. A **grounding gate (`check_claims`)** sorts every claim into grounded / rejected / needs-confirmation — it never quietly "fixes" a claim to pass it.
- The one-line slogan: **"Every claim must be grounded."**

> **Source note.** Distilled from a portfolio-team intake. It's all public OSS (`AscendyProject/portfolio`, Apache-2.0), so the canonical facts come straight from the repo README. Same *trust-as-structure* vein as [the adversarial agent-pair harness redteam](/en/blog/redteam-launch-en/) and [how much hallucination to allow in AI-written prose](/en/blog/benevolent-lie-hallucination-en/).

## The real problem with an AI portfolio is that it lies

Building a portfolio or résumé with AI is easy. One prompt and plausible bullets pour out. But can you **trust** them?

The problem isn't quality — it's **trust**. Generative models confidently exaggerate, hallucinate achievements that never happened, and smoothly stuff in recruiter keywords. The reader (a hiring manager) knows this too. So the very label "AI-written" erodes trust. *Writing it nicely* is already free; *writing it credibly* is what nobody solved.

The portfolio harness drills into that one problem — **never invented** — all the way down.

## The usual trust model runs backwards

Most AI writers work like this:

> **The model generates text → you hope it's true.**

Verification is an afterthought, usually a human's job. If the model writes "cut Kubernetes cluster costs by 50%," whether that's real is something *the reader has to check separately.* Skip the check and the hallucination ships. "Don't make things up" in the prompt is a *request*, not a *guarantee*.

portfolio flips the arrow:

> **Pin the evidence first, deterministically → the model narrates only on top of that evidence → code verifies the citation of every claim.**

That's where "never invented" stops being a **prompt** and becomes **architecture**.

## Three layers — the model is called in exactly one place

```text
1. extract   (deterministic)  gh → your actual merged PRs / changed files → an Evidence set
2. narrate   (LLM)            the model writes contribution claims — over the given evidence, citing refs by id
3. ground    (deterministic)  check every claim: is the cited ref in the extracted Evidence set?
                              if not → drop it, or send to a human. Never ships.
```

The key is that **extract and ground never call a model.** Gathering the evidence and verifying the claims are both deterministic code. The model enters only in the middle — narrate, the one place that *writes a story.* That separation is the whole architecture. It's why this is testable and auditable.

An analogy: **the model is a lawyer, and the evidence envelope is sealed separately.** The lawyer may argue only by citing what's in the envelope; cite something that isn't there and the judge (the grounding gate) strikes the statement. There's no way for the lawyer to *manufacture* evidence.

## The grounding gate — no "quietly fixed to pass"

The heart of the verification layer is `check_claims(claims, evidence)`. It sorts every claim three ways:

- **grounded** — the cited ref really exists in the extracted Evidence set. Passes.
- **rejected** — cites nothing, or cites a ref that was never extracted. **Dropped.**
- **needs-confirmation** — an ambiguous boundary. **Sent to a human.**

One important detail — the gate does **not ask the model "is this true?"** That just invites more hallucination. Instead it runs a **deterministic check**: *does the cited ref exist in the evidence set?* "Deterministic checks before AI judgment" — the model writes the story, code matches the citations. The point is to *not* hand judgment back to the model.

And the gate never **quietly massages a weak claim into passing.** It drops it, or asks a human. "Plausibly patching it in" is exactly the path hallucinations ship through, and that path is structurally closed.

## Grounding isn't a one-time gate

What's interesting is that grounding is **re-enforced at every output stage.**

For example, `/resume` selects which bullets to include for a given job description. As it picks them, it re-checks each chosen bullet's ref against the grounded set (`enforce_grounding`). So it's not "we grounded the portfolio, so a résumé pulled from it must be safe" — it closes the door on hallucinated refs **at the very moment** the tailored résumé is built. Grounding sits not at the one entrance but at *every exit.*

## Honestly — where it is right now

Not exaggerating is this tool's identity, so the maturity gets stated honestly too.

- **early scaffold, v0.0.1.** The README calls itself that.
- **What actually ships today:** the deterministic grounding core (evidence extraction + gate), plus **`/portfolio`** (a grounded portfolio as Markdown), **`/resume`** (a JD-tailored grounded résumé), and **`/reference-check`** (grounded reference letters — every paragraph cites real evidence refs).
- **What's not yet (roadmap):** `/fit` (deterministic JD-match coverage %) and `/rating` (evidence-based skill profile) have **no code yet** — and `/rating` deliberately **won't** make ungrounded "top X%" absolute claims.

Keeping the tool's philosophy ("never invented") starting from the tool's *intro post* felt like the right call.

## Try it

```bash
# A grounded portfolio from your real GitHub work:
python -m portfolio --source-type github --source <repo-url> --author <handle>

# A résumé tailored to a JD:
python -m resume --source-type github --source <url> --author <handle> --jd <jd.txt>
```

The slash command `/portfolio` is the interactive front door. Repo: [github.com/AscendyProject/portfolio](https://github.com/AscendyProject/portfolio) (Apache-2.0).

## Takeaways

- **The bottleneck for AI writing tools isn't quality, it's trust.** Writing it nicely is free now; writing it credibly is the remaining problem.
- **"Don't make things up" is only guaranteed as structure, not a prompt.** Pin the evidence first, let the model narrate only on top of it, and have code verify the citations — don't rely on the model's good intentions.
- **Don't hand verification back to the model.** "Is this true?" invites more hallucination. Turn it into a deterministic check — *does the cited ref exist in the evidence?* — and trust becomes an auditable property.
- **Ground at every exit, not just the entrance.** Data that passed once must be re-checked when a new output (a tailored résumé, say) is built, or hallucination leaks out the back.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
