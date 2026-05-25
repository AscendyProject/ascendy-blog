# Round 001 — Codex Review

Verified:
- Read `docs/reviews/2026-05-25-skeleton-review-request.md`.
- Confirmed `ascendy-blog/` is not its own git repo yet; top-level git sees it as untracked.
- Ran `pnpm install` successfully. This created `pnpm-lock.yaml`, `node_modules/`, `.astro/`, and `dist/`.
- Ran `pnpm check` successfully under escalated permissions: 0 errors, 1 Astro hint for inline script handling in `SchemaOrg.astro`.
- Ran `pnpm build` successfully under escalated permissions: 2 pages built, sitemap and RSS generated.
- First sandboxed `pnpm check/build` failed only because Astro telemetry tried to create `~/Library/Preferences/astro`; that was an environment permission issue, not an app error.

### 1. 거버넌스 정합성
**Agree:** `CLAUDE.md` and `AGENTS.md` mostly inherit the top-level model correctly: Claude as main worker, Codex as independent reviewer, user-owned merge/deploy, no `wrangler deploy`, no `gh pr merge`, no sibling repo edits. The top-level forbidden surfaces are explicitly carried into the blog rules at `CLAUDE.md:80` through `CLAUDE.md:89`, and cmux safety is mirrored at `CLAUDE.md:234` through `CLAUDE.md:243`.

**Disagree:** The publish gate is only policy-level, not build-level. `CLAUDE.md:75` through `CLAUDE.md:79` says redaction must pass and drafts must not be merged, but the runtime publication filters only `draft`. A post with `draft: false` and `redactionReviewed: false` would publish through the post route at `src/pages/blog/[...slug].astro:5` through `src/pages/blog/[...slug].astro:10`, appear in the home page at `src/pages/index.astro:5` through `src/pages/index.astro:7`, appear in the blog index at `src/pages/blog/index.astro:5` through `src/pages/blog/index.astro:6`, and appear in RSS at `src/pages/rss.xml.ts:5` through `src/pages/rss.xml.ts:21`. Since `redactionReviewed` defaults to false at `src/content.config.ts:34` through `src/content.config.ts:35`, this is a real safety gap.

**Uncertain:** I did not inspect Cloudflare Pages repo settings, branch protection, or future top-level `.gitignore` changes. Those are intentionally user/top-level tasks.

### 2. Redaction 체크리스트 강도
**Agree:** The checklist covers the important top-level forbidden surfaces: `.env*`, `helm/langfuse-*`, kubeconfig/ServiceAccount tokens, Firebase JSON, DB passwords, private hostnames, private IP ranges, VCR image tags, R2 bucket names, business data, staff identity, screenshots, and external licensing. The strength is appropriate for a public AI-crawlable blog.

**Disagree:** The private-key grep command is not portable on macOS/BSD grep. `docs/redaction-checklist.md:14` uses `BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY`; running that shape locally produced `grep: empty (sub)expression`. This means a required verification step can fail before it checks anything. It should be rewritten to avoid the empty alternative or use the simpler pattern already present in `CLAUDE.md:162` through `CLAUDE.md:164`.

**Uncertain:** The checklist says R2 bucket names should be reconsidered at `docs/redaction-checklist.md:34` through `docs/redaction-checklist.md:35`, while public docs elsewhere name `blog.ascendy.ai` and public product domains. That is fine for now, but the team should decide later whether bucket names are always private or sometimes acceptable as architecture context.

### 3. 인테이크 형식 작동성
**Agree:** The template is usable for backend/frontend/infra teams. It captures team, proposer, date, topic, tags, urgency, related PRs, related decisions, public readiness, safe-to-share content, unsafe content, sanitized snippets, and reviewer preference. The processing flow at `docs/intake-template.md:75` through `docs/intake-template.md:83` matches the intended editorial loop.

**Disagree:** No merge-blocking issue. A useful later addition would be explicit `license/copyright` or `externalMaterials` metadata, because `docs/redaction-checklist.md:54` through `docs/redaction-checklist.md:57` requires license/source checks but the intake frontmatter does not ask submitters to declare them.

**Uncertain:** The template assumes teams will write directly into this repo's `docs/intake/from-*/`. If the blog repo is separate and public from day one, teams may need a private staging path for intake that is not yet redacted. The current template warns against internal links, but it still encourages preserving raw intake in the public blog repo.

### 4. Astro 구조의 작동성
**Agree:** Astro 5 Content Collections v2 is wired correctly with `src/content.config.ts` and `glob` at `src/content.config.ts:1` through `src/content.config.ts:9`. `pnpm check` and `pnpm build` both pass after dependency installation. Static Cloudflare Pages output works without an adapter for the current route set. Sitemap and RSS generation worked.

**Disagree:** `BaseHead.astro` hardcodes `og:type` to `article` for every page at `src/components/BaseHead.astro:26`. That is wrong for the home page and blog index, which use `WebSite` / `CollectionPage` JSON-LD via `BaseLayout.astro:20` through `BaseLayout.astro:21`. This is not a build blocker, but it weakens SEO/LMO consistency.

**Uncertain:** `SchemaOrg.astro:84` triggers an Astro hint that the script is treated as inline because it has attributes. Build passes, but adding `is:inline` later would make the intent explicit.

### 5. LMO 의식
**Agree:** The LMO posture is coherent: public `robots.txt`, explicit crawler allow rules, sitemap, RSS, canonical tags, JSON-LD, tight description length, and self-contained TL;DR guidance. `public/robots.txt` has 22 `User-agent` blocks including wildcard, GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot, and others.

**Disagree:** No LMO blocker. The only concrete SEO inconsistency is the `og:type` issue noted above at `src/components/BaseHead.astro:26`.

**Uncertain:** `llms.txt` and `llms-full.txt` are correctly marked as TODO at `CLAUDE.md:41` and `README.md:48`. I agree they should be next-round priority, but I would not block Round 001 on them.

### 6. 운영 모델 일관성
**Agree:** The intended flow is clear: intake, editorial rewrite, redaction, Codex review, human merge, Cloudflare Pages auto-deploy. The no-direct-deploy and no-direct-merge rules are consistent with the top-level workspace's operator model.

**Disagree:** The operational guard for accidental publication is incomplete for the same reason as item 1: all public routes filter only `draft`, not `redactionReviewed`. Policy says `redactionReviewed: true` matters, but build output ignores it. This should be fixed before treating the skeleton as merge-ready.

**Uncertain:** There is no current CI or pre-merge check because GitHub repo creation is intentionally deferred. That is acceptable for skeleton, but the first public repo PR should add a simple Pages-compatible check path or document that Cloudflare Pages build is the gate.

### Explicit Comparison Points

A. Dir placement: Agree with `ascendy-blog/` as gitignored sibling, provided the top-level `.gitignore`, inventory, and ownership docs are updated in a separate top-level PR before normal work starts.

B. Tailwind v4: Agree. `pnpm build` passed with `@tailwindcss/vite` and CSS-first setup.

C. Cloudflare adapter: Agree with omitting `@astrojs/cloudflare` for now. Current output is static; adapter would add complexity without a runtime need.

D. Redaction strength: Mostly agree, but the grep command at `docs/redaction-checklist.md:14` must be fixed.

E. Intake format: Agree with keeping the blog intake standard inside the blog repo. Do not integrate it into top-level `docs/agent-os/requests/` unless the user wants the blog process governed by infra docs.

REVIEW_DECISION: REQUEST_CHANGES
