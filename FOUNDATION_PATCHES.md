# Foundation patches

Template-owned paths this clone changed on purpose. `npm run foundation:drift` excuses every path listed here.

| Path | Change | Why | Upstream? |
|---|---|---|---|
| `src/core/authz/guards.ts` | `requireOrg(slug, perm)` calls `notFound()` for a missing permission instead of throwing `AuthzError` | F-04 (D-009): nothing catches `AuthzError` in a page render, so a `member` opening `/settings/billing` or `/settings/danger` got a 500. A 404 also matches "not yours ≡ not found". Server actions get the same 404 instead of a 500. | Yes: the bug is in the template. `AuthzError` stays for the checks inside `src/core/tenancy` and `src/core/share`. |
| `FOUNDATION_VERSION` | `v1.0.1` → `v1.0.3` | D-012: the v1.0.2 and v1.0.3 tags both still say `v1.0.1`, so after merging them the drift check compared against v1.0.1 and flagged every upstream change as clone drift. | Yes: bump the file in each release commit. Drop this row once a tag carries its own version. |
