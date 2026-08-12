---
title: "The MERGED badge can lie — when a stacked PR gets swallowed by a squash"
description: "A reviewed PR that GitHub marked MERGED had none of its code in main. The badge means 'merged into its own base,' not 'in main' — and when that base lands as a squash, commits stacked on top don't come along."
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
- The path was **stacked PRs plus a squash.** PR-A sat on PR-B's branch and merged into it; later PR-B landed on `main` as a squash-merge, which compressed **only PR-B's diff.** The commits stacked on top didn't come along.
- So the completion check has to be **a mechanical question about `main`'s tree, not a UI state.** Is the file in the tree, and is the PR's merge commit an ancestor of `main` — two lines, no judgment.

> **About this piece.** A postmortem distilled from a backend-team intake. The lost change has already been re-landed by a follow-up PR. **Its nature and domain, the constants involved, and internal branch names and PR numbers are generalized** — the lesson is intact without them. The deploy-side version of the same question ("what did the green signal actually measure?") is in [the deploy that deployed nothing](/en/blog/deploy-that-deployed-nothing-en/).

## The symptom — green light, missing code

Review was done, and GitHub displayed the PR as **MERGED.** Purple badge, closed, finished.

The file that PR was supposed to add wasn't in `main`.

This isn't a bug report or a failing CI run. It's **work marked done that wasn't.** What makes this class of incident nasty is that nobody feels anything is off. You see the badge and move on.

## The badge didn't lie — we read it as the answer to a different question

Before blaming GitHub, it's worth being precise about what the badge asserts.

**MERGED means "this PR's head was merged into *this PR's* base."** What that base happens to be is a separate matter. If the base is `main`, the two statements collapse into one. But **when the base is another feature branch, a gap opens between "merged" and "in `main`."**

What we wanted to know was *"did this change make it into the production branch?"* What the badge was answering was *"did this change make it into its own base branch?"* Those agree almost always, which is exactly why it's hard to see that they can differ.

## Where the squash swallows the stack

The second piece snaps on here.

The setup was an ordinary **stacked PR.** PR-B existed first, and follow-on work in PR-A was opened against PR-B's branch as its base. Review finished in that order, so PR-A merged into PR-B's branch first.

Then PR-B landed on `main` as a **squash-merge.** And the definition of squash is decisive here — **it compresses that PR's diff into a single commit on the base.** It doesn't carry the history over; it *rewrites the result.*

So PR-A's commits, sitting on PR-B's branch, never travelled to `main`. They still exist, just somewhere unreachable from `main`. And PR-A's badge is **still honestly MERGED** — its head really is reachable from its own base.

## Ask the tree, not the badge

The most practically useful part of this incident is the detection. The ground truth lives in the **tree**, not the UI.

First: is the file that change should have created actually in `main`'s tree?

```bash
git ls-tree -r main --name-only | grep '<expected/path>'
```

Second: is that PR's merge commit an ancestor of `main`? If not, the loss is confirmed.

```bash
git merge-base --is-ancestor \
  "$(gh pr view <PR-number> --json mergeCommit -q .mergeCommit.oid)" main \
  && echo "present in main" || echo "lost — not an ancestor of main"
```

Neither line involves human judgment. They ask **"is this reachable from `main`?"** directly, instead of "does this look done?"

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

## Prevention — unstack the moment the one below merges

It reduces to a single rule.

**When the lower PR merges, retarget the upper PR's base to `main` and rebase it.** Don't merge the upper PR into the lower branch first. The moment you do, the upper PR's fate is tied to how the lower branch lands — and if that's a squash, it gets swallowed.

One thing worth adding: this isn't a flaw in squash. Squash *deliberately* collapses intermediate history to keep the log clean. The problem is that the UI never tells you **another PR may be inside the range being collapsed.**

> **Different mechanism, same lesson.** While this piece was being written, the same class of thing happened in this blog's own repository. A correction commit was pushed and the PR was merged moments later — but the merge commit's parent was the commit *before* the correction, so the fix stayed on the branch. No stack, no squash, and the same outcome: **the PR says MERGED and the change isn't in `main`.** The answer was the same here too — check `main`'s contents directly instead of the badge.

## Takeaways

- **A MERGED badge ≠ the code is in `main`.** It means "the head merged into its own base." If that base isn't `main`, a gap exists.
- **Squash collapses intermediate history on purpose.** Commits that were stacked on that branch don't come along.
- **Judge completion from the tree, not the UI.** `git ls-tree` for existence, `git merge-base --is-ancestor` for reachability.
- **Re-land file by file, and check the `main`-side diff is empty first.** Otherwise recovery becomes a second incident.
- **Unstack as soon as the one below merges** — retarget the upper PR's base to `main` and rebase.

A green light is always measuring *something.* Incidents happen when that something isn't what you wanted to know.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
