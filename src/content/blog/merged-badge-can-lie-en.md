---
title: "The MERGED badge can lie — the PR that vanished by 16 seconds"
description: "A reviewed PR that GitHub marked MERGED had none of its code in main. The badge means 'merged into its own base,' not 'in main' — and that base branch had left for main 16 seconds earlier, with nothing left to carry it."
pubDate: 2026-08-12
author: "Ascendy Engineering"
tags: ["git", "github", "squash-merge", "stacked-prs", "ci-cd", "incident-prevention", "postmortem"]
category: "backend"
lang: "en"
translationKey: "merged-badge-can-lie"
sourceIntake:
  - "docs/intake/from-backend/2026-08-07-stacked-pr-squash-merge-loss.md"
draft: false
redactionReviewed: true
---

## TL;DR

- A PR had been reviewed and GitHub showed it as **MERGED.** None of its code was in `main`.
- The badge didn't lie. It just means **"the head was merged into *this PR's* base,"** not **"reachable from main."** When the base isn't `main`, a gap opens between those two.
- The margin was **16 seconds.** PR-A's base wasn't `main` but another feature branch (PR-B's head) — and **that branch had already been squash-merged into `main` 16 seconds before PR-A merged into it.** Nobody merged that branch again, so PR-A's change had no route to `main` at all.
- So the completion check has to be **a mechanical question about `main`'s contents, not a UI state.** But not commit reachability (`--is-ancestor`) — in a squash repo even a properly landed PR reads as "unreachable," so you have to ask by **comparing content.**

> **About this piece.** A postmortem distilled from a backend-team intake. The lost change has already been re-landed by a follow-up PR. **Its nature and domain, the constants involved, and internal branch names and PR numbers are generalized** — the lesson is intact without them.
>
> The draft explained the cause as *"the squash dropped the commits stacked on top."* **An adversarial review pointed out that this doesn't match how git behaves, so we re-examined the commit graph and corrected it.** The real cause was the ordering problem described below. Without that review we'd have shipped a wrong mental model. Same vein as [why a simple change took 12 rounds](/en/blog/why-a-simple-change-took-12-rounds-en/), and the deploy-side version of "what did the green signal actually measure?" in [the deploy that deployed nothing](/en/blog/deploy-that-deployed-nothing-en/).

## The symptom — green light, missing code

Review was done, and GitHub displayed the PR as **MERGED.** Purple badge, closed, finished.

The file that PR was supposed to add wasn't in `main`.

This isn't a bug report or a failing CI run. It's **work marked done that wasn't.** What makes this class of incident nasty is that nobody feels anything is off. You see the badge and move on.

## The badge didn't lie — we read it as the answer to a different question

Before blaming GitHub, it's worth being precise about what the badge asserts.

**MERGED means "this PR's head was merged into *this PR's* base."** What that base happens to be is a separate matter. If the base is `main`, the two statements collapse into one. But **when the base is another feature branch, a gap opens between "merged" and "in `main`."**

What we wanted to know was *"did this change make it into the production branch?"* What the badge was answering was *"did this change make it into its own base branch?"* Those agree almost always, which is exactly why it's hard to see that they can differ.

## The actual order — 16 seconds

Here's where the second piece snaps on. And this is the part we got wrong at first.

The setup was an ordinary **stacked PR.** PR-B existed first, and follow-on work in PR-A was opened against PR-B's branch as its base. Nothing unusual so far.

The problem was **the order they merged in.** Reconstructing the commit graph:

```text
07:56:51   PR-B  →  squash-merged into main     (the base branch leaves for main)
07:57:07   PR-A  →  merged into PR-B's branch   (16 seconds later, into a place already gone)
```

PR-A merged into its base branch **after that branch had already landed on `main`.** The branch still existed, so the merge succeeded normally and the badge honestly turned MERGED. But **no subsequent merge would ever carry that branch to `main`** — PR-B was already done merging.

PR-A had been merged into **a dead end.** Had the order been reversed by those 16 seconds, PR-A's change would have been part of PR-B's diff and gone up to `main` with it.

The role of the squash needs to be stated precisely too. **The squash did not drop the commits stacked on top.** If PR-A had landed on the branch first and PR-B were squashed afterwards, PR-A's changes would have been inside PR-B's diff and gone along — a squash erases commit lineage, not file changes.

What the squash did do is different. Instead of attaching the branch's commits to `main`, it **rewrote the result as a new commit.** So that branch is not an ancestor of `main`, and the fact that "this branch has already landed" is nowhere to be seen in the commit graph. The branch looks perfectly alive, and merging into it succeeds without a word of warning.

## Ask the contents, not the badge

The most practically useful part of this incident is the detection. The ground truth lives in **`main`'s contents**, not the UI.

Start with the method you must *not* use. **Don't judge by "is this PR's merge commit an ancestor of `main`?"**

```bash
# Don't — this has no discriminating power in a squash repo
git merge-base --is-ancestor "$(gh pr view <N> --json mergeCommit -q .mergeCommit.oid)" main
```

In a repository that merges by squash, **the merge commit of a perfectly landed PR is also not an ancestor of `main`**, because the squash rewrote the result as a new commit. That check labels both healthy and lost as "lost," so it filters nothing.

What works is a **content comparison** — does the branch still hold anything `main` doesn't have?

```bash
# Empty output means main already has that content for those paths (however it landed).
# Non-empty means there are changes main is still missing.
git diff main "$(gh pr view <N> --json headRefOid -q .headRefOid)" -- <paths>
```

If the PR adds new files, an existence check is a decent first pass — but only for **additions**; it says nothing about PRs that modify or delete existing files.

```bash
git ls-tree -r main --name-only | grep '<expected/path>'
```

And the cheapest signal for catching this **before** it happens is a different one entirely: **if the PR you're about to merge has a base other than `main`, check first whether that base branch has already been merged.** That condition was precisely this incident's trigger.

## Recovery — re-land without overwriting

The easiest mistake during recovery is to re-merge the lost branch wholesale and **revert whatever landed in `main` in the meantime.**

So we landed it file by file: branch from current `main`, and pull **only the needed files** from the lost branch.

```bash
git switch -c <recovery-branch> main

# First: confirm those files haven't changed in main since the fork point.
# The output must be empty — if it isn't, that file needs a manual merge.
git diff "$(git merge-base <lost-branch> main)" main -- <files>

git checkout <lost-branch> -- <files>
```

That empty-diff check is the crux. Without it, the recovery quietly becomes **a second incident that reverts `main`'s newer work.** After that it's the usual path: verify, open a new PR.

The other stacked PR was handled from the opposite side — **retarget its base to `main` and rebase**, removing the route into the trap entirely.

## Prevention — retarget the upper PR the moment the lower one lands

It comes down to this.

**Don't merge the upper PR until the lower one is in `main`. Once it is, retarget the upper PR's base to `main`, rebase, and then merge.** This incident happened when that order was inverted by sixteen seconds.

The uncomfortable part is that this leans on people remembering the order. As a sixteen-second gap suggests, this is less carelessness than **a path with no guardrail.** You can't tell from a branch that its PR has already merged, and merging into it meets no resistance at all.

So it's safer to add one more rule: **delete the branch immediately after merging.** If the branch is gone, nothing can merge into it, and GitHub retargets any open PR whose base branch was deleted onto the base above it. That removes the wrong path instead of asking people to remember the order.

One thing worth adding: this isn't a flaw in squash. Squash *deliberately* rewrites the result to keep history clean. The problem is that this erases "this branch has already landed" from the commit graph — and the UI doesn't tell you.

> **Different mechanism, same lesson.** While this piece was being written, the same class of thing happened in this blog's own repository. A correction commit was pushed and the PR was merged moments later — but the merge commit's parent was the commit *before* the correction, so the fix stayed on the branch. No stack, no squash, and the same outcome: **the PR says MERGED and the change isn't in `main`.** The answer was the same here too — check `main`'s contents directly instead of the badge.

## Takeaways

- **A MERGED badge ≠ the code is in `main`.** It means "the head merged into its own base." If that base isn't `main`, a gap exists.
- **Merging into an already-merged branch is a dead end.** The merge succeeds and the badge lights up, but no later merge will carry that branch to `main`.
- **The squash doesn't drop commits.** It rewrites the result as a new commit — which is what erases "this branch already landed" from the graph and makes the dead end look alive.
- **Don't judge by reachability.** In a squash repo even a healthy landing fails `--is-ancestor`. Ask by **content comparison** (`git diff main <head> -- <paths>`).
- **Re-land file by file, and check the `main`-side diff is empty first.** Otherwise recovery becomes a second incident.
- **Delete branches right after merging.** Remove the wrong path instead of relying on people to remember the order.

A green light is always measuring *something.* Incidents happen when that something isn't what you wanted to know.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
