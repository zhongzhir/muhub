# MUHUB Daily AI Discovery Workflow

## Goal

Use AI to prepare a larger, better-ranked discovery queue while keeping final publishing under human review.

The workflow should expand MUHUB beyond AI-only projects. `isAiRelated` is a tag and short-term priority signal, not an admission rule.

## Admission Model

Use these concepts separately:

| Field | Meaning | Admission effect |
| --- | --- | --- |
| `isProject` | The item is a real project, product, open-source repo, organization initiative, or innovation case. | Required for candidate import. |
| `innovationScore` | How well the item fits MUHUB's innovation-project scope. | Primary ranking signal. |
| `isAiRelated` | The item has a clear AI component or AI-native positioning. | Tag and small priority boost only. |
| `sourceQuality` | Whether the item has verifiable sources such as official site, repo, docs, article text, Product Hunt, or social account. | Review and publish readiness signal. |
| `publishReadiness` | `ready`, `needs_review`, or `reject`. | Controls queue placement, not automatic publishing. |

Do not reject a candidate only because `isAiRelated` is false.

## Daily Flow

1. Run source discovery.
   - GitHub V3 discovery.
   - RSS discovery.
   - Configured DiscoverySource entries.
2. Preserve raw material.
   - Mobile-captured article links stay as source material until extraction.
   - WeChat article title/body should be stored as `ProjectSource(kind=WECHAT_ARTICLE)` after import.
3. Prepare candidates.
   - Run enrichment for pending candidates.
   - Run classification for pending candidates.
   - Refresh `reviewPriorityScore` and `reviewPrioritySignals`.
4. Review in admin.
   - Human review decides approve, reject, merge, or publish.
   - Bad or premature records should be hidden by filters/status, not deleted.

## Current Automated Entry

`GET /api/cron/daily-discovery`

Behavior:

- runs `runDiscoveryScheduledJob()`;
- processes a bounded batch of pending `DiscoveryCandidate` rows;
- runs enrichment and classification when pending;
- recomputes review priority;
- does not import, merge, or publish projects automatically.

Query switches:

- `candidateLimit=20` controls candidate batch size, capped in code.
- `sources=0` skips source discovery.
- `enrichment=0` skips enrichment.
- `classification=0` skips classification.

The endpoint is deployment-neutral. Vercel Cron can call it when the Vercel
deployment has the same production database and secrets, but the primary
Alibaba Cloud deployment should also be able to trigger the same URL from
Alibaba Cloud scheduled tasks or any trusted cron runner with `CRON_SECRET`.

Alibaba Cloud can also run the same workflow locally from the MUHUB project
directory:

```bash
pnpm discovery:daily
```

Optional environment switches:

- `DAILY_DISCOVERY_CANDIDATE_LIMIT=20`
- `DAILY_DISCOVERY_SOURCES=0`
- `DAILY_DISCOVERY_ENRICHMENT=0`
- `DAILY_DISCOVERY_CLASSIFICATION=0`

## Mobile Capture Automation

`POST /api/admin/discovery/mobile-capture` now keeps the captured material and,
when a URL is present, immediately attempts the article pipeline:

1. fetch article text from the captured URL;
2. extract GitHub, GitCC, Product Hunt, and general project mentions;
3. enqueue ready extracted projects into the discovery queue;
4. return extraction counts to the mobile capture UI.

Duplicate captured URLs are stored only once and skip automatic extraction.
If extraction fails, the raw material remains available for manual extraction.
The mobile capture list also exposes a per-item retry action backed by:

`POST /api/admin/discovery/mobile-capture/:id/auto-extract`

## Daily Workbench

`/admin/discovery/daily` provides the first operational view for the daily AI
discovery workflow. It is read-only and uses existing data:

- today's `DiscoveryRun` totals and failure reasons;
- candidates first seen today;
- duplicate or already-linked leads updated today;
- pending high-priority review queue;
- candidates that look ready for publish review;
- enrichment, classification, and mobile auto-extraction failures.

The "ready for publish review" group is an operational shortlist, not automatic
publishing. It requires pending import/review status, a meaningful source,
description, analysis/enrichment signal, and a high review-priority score.

## Human Review Rule

AI should reduce manual work before review, not remove accountability at publish time. In the first phase, the safe target is:

- AI handles discovery, extraction, enrichment, classification, and ranking.
- Humans handle final source check, correction, reject/merge/approve, and publish.
