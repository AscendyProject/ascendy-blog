---
title: "GitHub Actions to GCP without a long-lived key — the hard part wasn't WIF"
description: "We swapped the SA-key-in-a-Secret path for Workload Identity Federation. The WIF spec is short; six days went into the details around it — and what static review catches differs from what only a live run reveals."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["workload-identity-federation", "github-actions", "gcp", "ci-cd", "oidc", "security"]
category: "infra"
lang: "en"
translationKey: "wif-github-actions-gcp"
sourceIntake:
  - "docs/intake/from-frontend/2026-06-01-wif-github-actions-gcp.md"
draft: false
redactionReviewed: true
---

## TL;DR

- We started Android deploy automation the obvious way — **an SA key base64'd into a GitHub Secret** — then switched to Workload Identity Federation after GCP's console warned us off downloading keys.
- **The WIF spec itself is short.** The six days went into the details around it — that the credential lives **5 minutes, not 1 hour**; that the provider condition must bind to **immutable numeric IDs, not mutable names**; that Gradle Play Publisher won't auto-enable ADC; a JDK version race on the runner.
- **Five rounds of static review** caught seven holes the diff alone didn't show. And the first **live run still failed three more times** — at things static review structurally cannot see (a disabled API, the runner's environment, step ordering).
- The lesson lives on that boundary: what a spec comparison catches and what only an actual run reveals are different sets.

> **Source note.** This post distills an intake the frontend team left while moving an Android internal-test deploy pipeline (`docs/intake/from-frontend/2026-06-01-wif-github-actions-gcp.md`). GCP project / service account / Pool / Provider identifiers and repository names and numeric IDs are generalized to placeholders. The patterns here (WIF flow, immutable-ID binding, the 5-minute ceiling, GPP's ADC opt-in, the JAVA_HOME pin) are all applications of public Google / GitHub / GPP guidance.

## It started on the obvious path

At first we took the path everyone takes. Issue a Service Account JSON key, base64-encode it, paste it into a GitHub repository Secret, decode it inside the workflow. It works. But on the key-generation screen, the GCP console raised its standard warning.

> Service account keys could pose a security risk if compromised. We recommend you avoid downloading service account keys and instead use the Workload Identity Federation.

A leaked long-lived key *is* GCP access, indefinitely, and you own its expiry and rotation by hand. We took the warning's advice — and that was the start of a six-day arc. To be clear, the hard part was never *what WIF is*. The big picture fits in a paragraph. What held us up were the **small details around it**.

## The picture that worked

The core flow is this. No long-lived key anywhere.

```
GitHub OIDC token  ──▶  GCP STS subject token  ──▶  SA impersonation
   (5-min lifetime)        (exchanged via WIF)        (ADC chain)
```

The workflow needs three things.

- `permissions: id-token: write` at the top level. Without it the auth step dies with `OIDC token request not authorized for this workflow`.
- `google-github-actions/auth` pinned to a **full commit SHA**, not a floating tag — this is a credential-bearing workflow.
- Three inputs locked explicitly: `create_credentials_file: true`, `export_environment_variables: true`, `cleanup_credentials: true`. If a future major changes a default, the contract drifts silently; locking the inputs prevents that.

## Detail 1 — the trust boundary is the immutable numeric ID

The first cut of the provider condition was the obvious one.

```
attribute.repository == 'org/repo'
```

On a credential-bearing path, this is wrong. **Repository names are mutable** — they can be renamed, transferred, deleted and re-squatted. An attacker briefly squatting a freed name could mint OIDC tokens that satisfy the condition. The correct form binds to the **immutable numeric IDs** GitHub also emits.

```
attribute.repository_id == '<numeric>' &&
attribute.repository_owner_id == '<numeric>' &&
attribute.ref == 'refs/heads/main'
```

The `attribute.ref` clause matters too. Even with a "main-only" guard at the application layer, that guard runs *after* IAM evaluates the OIDC token. If another workflow in the same repo calls auth from a non-main ref, the OIDC exchange succeeds at IAM before the application gate ever fires. The `principalSet://...` IAM binding likewise must use `repository_id/<numeric>`, not `repository/<name>`. Mutable string identifiers are a trapdoor; immutable numeric IDs are the trust boundary.

## Detail 2 — the credential lives 5 minutes, not 1 hour

The most-corrected misconception. The auth action emits two flows.

| Flow | Effective lifetime |
|---|---|
| `create_credentials_file: true` (the ADC config this pattern uses) | **5 minutes** — derived credentials inherit the GitHub OIDC token's expiry |
| `token_format: access_token` (a different flow) | up to 1 hour, but the plaintext access token sits in the runner env |

We chose the first, where no plaintext token lives in the runner. The operational implication is sharp — **everything from the auth step to the Play upload must finish inside 5 minutes**. So we moved the auth step as late as possible, after `npm ci` and the Android build, right before the Gradle upload. Conversely, we did *not* add a "warmup" step to trigger an early STS exchange — it spends budget without extending it. (Static review cut a "warmup to buy time" suggestion for exactly this reason.)

## Detail 3 — GPP won't turn on ADC for you

Gradle Play Publisher (GPP) does not auto-enable ADC just because you removed `serviceAccountCredentials.set(...)`. Per its README's auth section, it demands an explicit auth-strategy choice and fails with `No credentials specified` otherwise.

```gradle
play {
    def adcPath = System.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    if (adcPath) {
        useApplicationDefaultCredentials.set(true)
        resolutionStrategy.set(ResolutionStrategy.AUTO)
    }
}
```

Gating on the presence of `GOOGLE_APPLICATION_CREDENTIALS` doubles as a **local/CI split**. A local `bundleRelease` (no ADC) stays on GPP's default `IGNORE` strategy, so the version-code-resolution task doesn't query Play and fail.

## Detail 4 — setup-java ordering and the JAVA_HOME race

`actions/setup-java` and `android-actions/setup-android` interact in non-obvious ways.

- `setup-android`'s `sdkmanager --licenses` requires JDK 17+. The ubuntu-22.04 runner's default `JAVA_HOME` points at JDK 11. So `setup-java` must run **first** to give `sdkmanager` a JDK 21 to detect.
- After that, any step can mutate `JAVA_HOME`. So in the Gradle invocation step we pin the launching JVM with `env: JAVA_HOME: ${{ steps.setup-java.outputs.path }}`. Shell-level Java alone isn't enough — the JVM that *launches Gradle* is what decides `invalid source release: 21`.

Two diagnostic steps stay **permanently**: `echo "$JAVA_HOME"; java -version` after `setup-java`, and `./gradlew --version` inside the Gradle invocation. Add-then-remove, and the next toolchain drift reappears as a two-minute compile error. Keep them, and it shows up in the next dispatch log instead.

## What static review catches vs what only a live run reveals

This is where the real lesson is.

The change went through **five rounds of static review** (a close read comparing the change against the spec it claims to implement) before APPROVED. Each round caught a real hole the diff alone didn't show — the missing GPP ADC opt-in, the mutable-name condition, the auth step sitting ahead of the long build, the "1-hour ceiling" overclaim, the "warmup to extend budget" misconception, a suggestion to add an input from a flow we don't use, a "verified options" overstatement. In every case the diff was internally coherent, and comparison against the upstream docs is what exposed the gap.

And yet, after all five rounds passed, the **first live run failed three more times.**

1. **Google Play Android Developer API not enabled.** WIF succeeded, GPP got credentials, GPP called Play, and Play returned `SERVICE_DISABLED`. One click in the console.
2. **`java-version: 17` in the workflow.** Capacitor 8's Android module declares `JavaVersion.VERSION_21` for source/target, and JDK 17 can't accept source 21. Local builds had hidden this because Android Studio's bundled JBR is JDK 21.
3. **Step ordering.** A too-clever swap putting `setup-android` before `setup-java` made `sdkmanager` find the runner's pre-installed JDK 11 and reject it. Reverted.

All three are things a **spec comparison structurally cannot catch** — an external cloud's enablement state, the JDK actually installed on the runner, side effects of the execution environment. Static review's job is "is the change faithful to the spec," and that's where it ends. Beyond that, you have to run it once. (Thanks to the permanent diagnostics from Detail 4, #2 and #3 showed up in the next dispatch's log within 30 seconds.)

## Decisions and trade-offs

- **SA key vs WIF.** A long-lived key is five minutes to set up but valid indefinitely if leaked, with rotation on you. WIF is days to set up but the credential lives five minutes and no plaintext lingers. For a repeated deploy pipeline, the upfront cost is worth it.
- **5-minute flow vs 1-hour flow.** The ADC config flow (5 min) leaves no plaintext token but forces the pipeline into a 5-minute budget. The `access_token` flow (1 hour) is roomier but parks a plaintext token in the runner. We chose the smaller exposure surface.
- **Mutable name vs immutable ID.** Name binding reads easily but is open to rename/squat. Numeric-ID binding reads poorly but the trust boundary is solid. On a credential path, we gave up readability.

## Patterns worth carrying forward

- Pin every action in a credential-bearing workflow to a **full commit SHA** (human-readable tag in a trailing comment). Floating major tags belong only on non-credentialed paths.
- A top-level `permissions:` of `contents: read` + `id-token: write` only. Default-deny the rest.
- A credential's effective lifetime depends on the **flow you chose**, not the auth action's advertised capability. Read the "Token lifetimes" section for your flow.
- A small idempotent `setup-wif.sh` makes re-rotating a Pool / Provider / SA a 30-second job later. Operator runbook material.
- Diagnostic steps printing `JAVA_HOME` and `./gradlew --version` belong in the workflow **permanently**, not temporarily. Toolchain drift is silent until it isn't.

---

**Authorship & citation**: Written by Ascendy Engineering; quotable with attribution. Found something wrong? Let us know via a GitHub issue.
