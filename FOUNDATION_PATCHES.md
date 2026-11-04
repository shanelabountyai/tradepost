# Foundation patches

Template-owned paths this clone changed on purpose. `npm run foundation:drift` excuses a path only while its diff still matches the hash listed (FR-09, v1.1.0).

| Path | Change | Why | Upstream? |
|---|---|---|---|
| `src/core/authz/guards.ts` `9be0ce64a05f` | `requireOrg(slug, perm)` calls `notFound()` for a missing permission instead of throwing `AuthzError` | F-04 (D-009): nothing catches `AuthzError` in a page render, so a `member` opening `/settings/billing` or `/settings/danger` got a 500. A 404 also matches "not yours ≡ not found". Server actions get the same 404 instead of a 500. | Yes: the bug is in the template. `AuthzError` stays for the checks inside `src/core/tenancy` and `src/core/share`. |
| `src/proxy.ts` `e21e63873617` | New file: every route sits behind a shared HTTP Basic password (`DEMO_ACCESS_PASSWORD`, logic in `src/lib/demo-gate.ts`), except `/api/cron` and `/api/webhooks/stripe`, which carry their own credential | The deployed demo (2026-10-02) runs `DEMO_MODE=1`, so `/demo` signs anyone in as an owner or the platform admin. Same gate as callboard, showcall and rent. | Yes: the template ships no proxy, and a gate for demo deployments belongs upstream (callboard raised it too). |
