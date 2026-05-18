# 2026-05-15 AI Discovery Workflow Change Log

## Commit

- Commit: `3f061fbc265fa3835e64152cbd0d590a2a19d102`
- Short hash: `3f061fb`
- Message: `feat(discovery): add AI daily workflow`
- Branch: `main`
- Remote: `origin/main`
- Commit time: `2026-05-15T20:46:48+08:00`

## Goal

Turn MUHUB's daily project discovery work from a mostly manual process into an AI-assisted workflow:

- keep human review and publishing control;
- let AI and background jobs handle discovery, extraction, enrichment, classification, and ranking;
- treat `isAiRelated` as a tag and short-term priority boost, not as an admission gate;
- broaden discovery toward common innovation projects, not only AI-related projects.

## Main Changes

### Daily Discovery Workflow

Added `runDailyDiscoveryWorkflow()` in `lib/discovery/daily-discovery-workflow.ts`.

It now:

- runs the existing scheduled discovery job, including GitHub/RSS paths already wired by `runDiscoveryScheduledJob()`;
- scans a bounded batch of pending `DiscoveryCandidate` rows;
- runs enrichment for pending candidates;
- runs classification for pending candidates;
- recomputes `reviewPriorityScore` and `reviewPrioritySignals`;
- does not import, merge, or publish projects automatically.

### Cron and Alibaba Cloud Entrypoints

Added HTTP cron endpoint:

- `GET /api/cron/daily-discovery`
- file: `app/api/cron/daily-discovery/route.ts`

Added local script entrypoint for the Alibaba Cloud production host:

- `pnpm discovery:daily`
- file: `scripts/run-daily-discovery.ts`

Updated `vercel.json` to add a Vercel Cron trigger as an auxiliary scheduler. The production recommendation remains: if Alibaba Cloud is the primary deployment, use Alibaba Cloud cron/systemd/task scheduling against the same workflow.

### Mobile Capture Auto Extraction

Updated the mobile capture flow so submitted article links are no longer only stored for manual processing.

Changed files:

- `app/api/admin/discovery/mobile-capture/route.ts`
- `lib/discovery/mobile-auto-extraction.ts`
- `agents/discovery/discovery-store.ts`
- `app/admin/discovery/mobile/mobile-capture-form.tsx`
- `app/admin/discovery/mobile/page.tsx`
- `app/admin/discovery/mobile/mobile-auto-extract-button.tsx`
- `app/api/admin/discovery/mobile-capture/[id]/auto-extract/route.ts`

Behavior:

- save the original mobile capture as source material;
- if a URL is detected, fetch article text and run the existing extraction pipeline;
- extract GitHub, GitCC, Product Hunt, and general project mentions;
- enqueue ready extracted projects into the discovery queue;
- write extraction status back to source-material metadata;
- expose a per-item retry button for failed or old captured material.

Stored metadata includes:

- `autoExtractionStatus`
- `autoExtractionUpdatedAt`
- `autoExtractionReason`
- `autoExtractionError`
- `autoExtractionTotal`
- `autoExtractionQueued`
- `needsExtraction`

### Daily AI Discovery Workbench

Added a first read-only operational dashboard:

- route: `/admin/discovery/daily`
- file: `app/admin/discovery/daily/page.tsx`

It shows, using Beijing/Shanghai day boundaries:

- today's discovery runs;
- fetched / parsed / new / updated counts;
- today's new candidates;
- duplicate or already-linked leads;
- pending review candidates;
- candidates suggested for priority publish review;
- enrichment/classification failures;
- mobile auto-extraction failures.

Added an entry link from `/admin/discovery`.

The "priority publish review" section is only an operational shortlist. It does not publish automatically.

### Documentation

Added:

- `docs/discovery/daily-ai-discovery-workflow.md`

This documents:

- the non-AI-only admission rule;
- daily workflow stages;
- cron and Alibaba Cloud entrypoints;
- mobile capture automation;
- retry endpoint;
- daily workbench scope.

## Validation

Completed:

- `pnpm install` completed after running with elevated permissions due to local `node_modules` permission issues.
- `pnpm build` passed with elevated permissions.
- Targeted lint for changed files passed.
- `git diff --check` passed.

Known existing validation noise:

- Full `pnpm lint` still fails on existing `scripts/monitor-muhub-site.js` CommonJS `require()` lint rules.
- Standalone `pnpm typecheck` still fails on implicit `@types/*` package entry issues, but `next build` completed its production build and type/lint phase successfully.
- Build warnings remain for existing Edge Runtime imports involving Upstash/NextAuth/Jose; they were warnings, not build blockers.

## Deployment Notes

The commit has been pushed to `origin/main`.

After deployment, manually check:

1. `/admin/discovery/mobile`
   - submit a public article/WeChat link;
   - confirm auto extraction result appears;
   - confirm retry works for a captured item.
2. `/admin/discovery/daily`
   - confirm today's dashboard loads;
   - confirm counts and failure sections render.
3. Scheduler
   - on Alibaba Cloud, run `pnpm discovery:daily`, or call `GET /api/cron/daily-discovery` with `CRON_SECRET`;
   - Vercel Cron can act as auxiliary trigger only when it points to the same production database and complete env vars.

## Follow-Ups

- Move more article extraction code out of `app/admin/discovery/items/actions.ts` into shared `lib` modules so cron/API paths depend less on page actions.
- Add a persisted daily run summary if historical reports need to outlive raw `DiscoveryRun` rows.
- Add filters to `/admin/discovery/daily` for yesterday / 7 days / source-specific views.
- Decide whether high-confidence candidates should be auto-imported as drafts, still without auto-publishing.
