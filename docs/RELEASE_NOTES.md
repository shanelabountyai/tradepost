# Release notes / artifact index

Closure deliverables (D-017), so nothing published gets lost in the gallery.

| Artifact | URL | Notes |
|---|---|---|
| Tradepost in Brief (exec brief) | https://claude.ai/artifact/C5N7FvEoizZszzzszTLc2Q | Non-engineering one-pager, v3. Refreshed 2026-09-29 with the four P1 features (D-018, D-022, D-023, D-024); numbers re-verified against a clean sweep that day (232 tests, 10 e2e). **Still private — share it from the page's Share menu before the queued LinkedIn posts that link to it go out.** |
| Lab Intelligence Ledger | https://claude.ai/artifact/Ai5xKScgT2sWtqXRQ1ZA8i | Cross-project LinkedIn draft queue. Tradepost has 6 drafts as of 2026-09-28 (posts 76–81): blind reviews, no provider payout release, dispute split, an AI red-team finding a delete-guard race, a negative-control test catching a cron bug, and an upstream drift-checker false positive. |
| GitHub repo | https://github.com/shanelabountyai/tradepost | **Public since 2026-10-04** (D-028). History rewritten to remove the template's portfolio `audit/`. |
| Live demo | https://tradepost.labintelligence.co | Deployed 2026-10-03 (D-026). Shared password (`DEMO_ACCESS_PASSWORD` in `.env.production.local`), then `/demo`. Vercel project `tradepost`, Neon `icy-wave-14607298`. |
| Claude Code build log | https://claude.ai/artifact/28KeGV3xfBwcBuoMEQjFMj | Cross-project tracker. Tradepost's row (`marketplace`) synced 2026-10-03: status shipped; PRD, repo, WRITEUP.md, live URL, CMO write-up (exec brief) and demo (DEMO.md) all linked. |

## Cost review

See `docs/decisions.md` → D-017. The live demo is deployed (2026-10-03); D-026 supersedes D-017's rows. Baseline was $0/month before it.
