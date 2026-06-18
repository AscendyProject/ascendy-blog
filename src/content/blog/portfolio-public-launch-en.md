---
title: "I built a portfolio harness to change jobs — and made 'don't make things up' structural"
description: "No tool optimized my agent-assisted job switch, so I built and shipped one (portfolio, Apache-2.0). 'Don't make things up' is structural here: pin evidence first, the model writes on top, a gate rejects unbacked claims."
pubDate: 2026-06-17
author: "Ascendy Engineering"
tags: ["grounding", "ai", "portfolio", "developer-tools", "launch", "trust"]
category: "meta"
lang: "en"
translationKey: "portfolio-public-launch"
sourceIntake:
  - "docs/intake/from-portfolio/2026-06-17-portfolio-public-launch.md"
  - "docs/intake/from-user/2026-06-17-portfolio-launch-interview.md"
draft: false
redactionReviewed: true
---

## TL;DR

- **portfolio** is now public (Apache-2.0, v0.0.1), with all five commands shipped — `/portfolio`, `/resume`, `/reference-check`, `/fit`, `/rating`. It's a harness that turns a developer's real GitHub work into a **grounded portfolio**.
- No grand motive. **I'm thinking about changing jobs, I do most of my work with agents now, and I went looking for a harness to optimize that process — there wasn't one.** So I built one to use myself.
- The whole point is one thing — **don't make things up.** And I made that *structural*, not a *prompt*: pin the evidence first, the model writes only on top of it, and a **grounding gate** rejects any claim it can't back.
- Honestly: **I haven't actually job-hunted with it yet.** It's built and public, but "does a grounded portfolio actually get callbacks?" is the next post, not this one.

> **Source note.** This post comes from two sources — the technical canon from the portfolio team's intake (public OSS, verified directly with `gh`), and the first-person motivation from an operator interview (`/interview`). It's all public OSS (`AscendyProject/portfolio`), so the facts are checkable in the open repo. Same *trust-as-structure* vein as [the grounding-idea intro post](/en/blog/portfolio-harness-launch-en/), and it connects to [the adversarial agent-pair redteam](/en/blog/redteam-launch-en/), where this tool's principle came from.

## Why I built it — just to use it myself

Let me get the order honest. This didn't start with me watching an AI lie and getting angry.

I was thinking about changing jobs, and these days most of my work happens alongside agents. So I assumed there'd obviously be a tool to optimize the job-search side — portfolio, resume, applications — with agents too. There wasn't. Plenty of generators that emit plausible prose, but no harness that helps with the process while staying *tied to my actual record.*

So I built one to use. The reason that starting point matters is that **a tool I'm going to use myself has to be honest.** If it's a demo to show other people, flashy wins; but if I'm going to actually apply with this, an inflated resume comes back to bite me in the interview room.

## The principle isn't new — it came from redteam

Making "don't make things up" the core wasn't a sudden idea. It came from [**redteam**](/en/blog/redteam-launch-en/), a harness I built earlier.

What redteam tries to catch is the same problem — having *different models critique and argue adversarially* to find holes like non-fact-based hallucination. Building that, the same principle carried straight over to portfolio. A career is one of the most expensive surfaces for a hallucination to live on: a line you can't explain when someone says "walk me through this PR" is worse than no line at all.

## The fork — same goal, different machinery

Here's the interesting difference. redteam and portfolio share the *same* anti-hallucination goal, but the **machinery is different.**

- **redteam** catches it by *adversarial argument* — it makes a different model try to refute the output.
- **portfolio** catches it by *deterministic comparison* — code matches each cited ref against the evidence set (the grounding gate).

Why did portfolio go with "code checks the evidence" instead of "another model reviews it"? The reason is simple — **whether the answer is already fixed.**

When what you're reviewing has *no fixed answer* (is this code correct, is there a hole in the reasoning), making models fight adversarially is the best move. But a portfolio's answer is already pinned — **my real GitHub history.** Merged PRs and changed files are settled facts. So there's nothing for models to argue about; you just *compare against the fact.* The machinery follows **whether ground truth exists.**

## So what I built — the engine and five commands

The engine is one sentence: **pin the evidence deterministically first, let the model narrate only on top of it, and have code verify every citation.** It splits into three layers.

```text
1. extract  (deterministic)  gh / web → real merged PRs, changed files → Evidence set
2. narrate  (LLM)            the model writes contribution claims — on the given evidence, citing refs by id
3. ground   (deterministic)  check every claim: is the cited ref in the extracted Evidence?
                             → grounded / rejected / needs-confirmation
```

The key is that **extract and ground never call the model.** Gathering evidence and verifying citations are both deterministic code. The model sits in exactly one place in the middle — *writing the story.* That's what makes it testable and auditable. And the gate never asks the model "is this true?" (that just invites more hallucination) — it only runs the deterministic check of *whether the cited ref exists in the evidence.*

Five commands stand on this engine. The throughline is one thing — **grounding is re-enforced at every output, not just once.**

- **`/portfolio`** — the engine itself. A grounded portfolio in Markdown.
- **`/resume`** — a resume tailored to a job description. Even while tailoring, it re-checks each selected bullet's ref against the grounded set. Not "we grounded the portfolio, so the resume is safe too" — it re-passes the gate **at the moment it builds the tailored output.**
- **`/reference-check`** — a grounded recommendation letter. Letters are the format exaggeration flows into most naturally ("he is an exceptional…"), so the gate runs **per paragraph.** A paragraph that can't cite evidence disappears whole. Not nice words — *backed* words.
- **`/fit`** — how well my evidence matches a given JD. It's **hybrid**: deterministic code grades coverage% into a band (S/A/B/C/D) and **locks the score band**, and the agent only produces a fine score *within that band.* The model can't change the grade. (For honesty: this is a JD-keyword *coverage* rubric, not an "you're N% qualified" verdict.)
- **`/rating`** — a capability grade from my evidence. Same hybrid as `/fit`, but the input is evidence metrics (merged-PR count, changed-file breadth, stack diversity) rather than a JD, and each metric cites the exact ref it was computed from.

## What `/rating` *won't* do

The thing I most want to say about `/rating` is what it **refuses to do.**

`/rating` does not make population comparisons like "you're in the **top N%** of all developers." The reason is simple — to say that, you'd need *data comparing you to others*, and there isn't any. **Saying something you don't have is just making it up.** So the grade is strictly an evaluation of *my own evidence*, not a ranking against others, and the renderer blocks percentile vocabulary in the output (enforced by tests).

That's the tool's tone — rather than fabricate a basis for a line that sounds impressive, **promise less and keep it exactly.**

## The honest present — it isn't proven yet

Last part, honestly. The tool is built and the repo is public, but **I haven't actually changed jobs with it.**

The next step is to write real applications with it and see how many callbacks I get. If they come, that's a post; if they don't, that's also a post. Whether a grounded portfolio — an honest one, even if it isn't flashy — actually works is exactly the kind of fact I can't fabricate. So when the result is in, I'll write that down as it is, too.

This post *not fabricating a result* is itself a small proof of what the tool is trying to do.

## Try it

```bash
# A grounded portfolio from real GitHub work:
python -m portfolio --source-type github --source <repo-url> --author <handle>

# A grounded resume tailored to a JD:
python -m resume --source-type github --source <url> --author <handle> --jd <jd.txt>
```

Repo: [github.com/AscendyProject/portfolio](https://github.com/AscendyProject/portfolio) (Apache-2.0, public). The slogan stands — **"Every claim must be grounded."**

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
