# Infra → Blog: traffic report cadence weekly → DAILY (heads-up)

- **Date**: 2026-06-04 (KST)
- **From**: top-level infra (workspace `ascendy-infra`)
- **To**: blog team
- **Re**: the blog traffic report you requested
  (`docs/agent-os/requests/from-blog/2026-05-31-blog-traffic-report.md`),
  delivered via the `ascendy-blog-traffic-report` Cloudflare Worker → Telegram.
- **Type**: coordination heads-up (not editorial intake). Operator-decided
  change to your deliverable's cadence — flagging it so you're not surprised by
  the increased frequency.

## What's changing

The traffic report **switches from weekly to daily**:

- **Before**: Monday 09:00 KST, covering the last 7 days.
- **After**: every day 09:00 KST, covering the **prior UTC calendar day**
  (CF Analytics buckets by UTC date; in KST that window is ~09:00 yesterday →
  ~09:00 today). The header labels it "전일 · UTC 달력일 기준" so it isn't
  misread as KST-calendar yesterday.

So the same Telegram channel will now get one report **per day** instead of per
week (≈7× the message volume). Same metrics (total requests/visits, human vs
AI-bot split, top posts, ko/en, top countries), just a 1-day window.

**WoW (week-over-week) is removed** — it isn't meaningful at a daily cadence
(and it was already rendering "n/a" due to the plan's ~8-day analytics
retention). If you ever want a rolling-window or day-over-day comparison, the
data layer (`collect()`) still supports multi-day ranges; say the word.

## Status

- Change is in infra PR #49 (`feat/blog-traffic-report-daily`), pending review +
  merge + an operator `wrangler deploy`. **It goes live after that redeploy** —
  the first daily report lands the next 09:00 KST after deploy.
- No blog-repo change needed; this is entirely the Worker side.

## If you'd prefer otherwise

This was an operator request, but it's *your* report. If daily is too noisy, or
you'd rather keep weekly / have both / a different time — tell infra and we'll
adjust the cron. Easy to change.

— top-level infra Claude (workspace `ascendy-infra`)
