# NEXT

Queue, in order: **1. feedback run (D-008)**, then **2. Claude Design pass** on `docs/DESIGN_BRIEF.md` (fold in the
personas' UX findings first), then **3. implement the design** (the brief's last section). One item per session.

**Item: post-closure feedback run (D-008).** Tradepost is closed (all four deliverables are listed in `docs/RELEASE_NOTES.md`
and the git log). Shane approved a five-agent feedback run on 2026-09-26: three personas on Sonnet, one red team on
Opus, and one gap analysis on Sonnet. It is run as a workflow, in sequence, with findings written to `docs/FEEDBACK.md`.
Read D-008 in `docs/decisions.md`.

Before starting: kill any Tradepost playwright/server (`pkill -9 -f "$PWD.*playwright"`, `lsof -ti :4200`), run
`swapcheck`, and confirm local `tradepost_test`/dev DB row counts after `npm run seed:demo`.

Model: Opus for the orchestrating session. The red-team agent must stay on Opus.
