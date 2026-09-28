# Foundation patches

Template-owned paths this clone changed on purpose. `npm run foundation:drift` excuses a path only while its diff still matches the hash listed (FR-09, v1.1.0).

| Path | Change | Why | Upstream? |
|---|---|---|---|
| `src/core/authz/guards.ts` `9be0ce64a05f` | `requireOrg(slug, perm)` calls `notFound()` for a missing permission instead of throwing `AuthzError` | F-04 (D-009): nothing catches `AuthzError` in a page render, so a `member` opening `/settings/billing` or `/settings/danger` got a 500. A 404 also matches "not yours ≡ not found". Server actions get the same 404 instead of a 500. | Yes: the bug is in the template. `AuthzError` stays for the checks inside `src/core/tenancy` and `src/core/share`. |
