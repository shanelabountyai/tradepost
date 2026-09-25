# Changelog

Entries prefixed `security:` are mandatory for anything touching an invariant. Clones must take a `security:` release within 7 days.

## 1.0.0 (unreleased)

First release. Core (env, db with cloud guard, auth with magic link, sessions, TOTP and recovery codes, tenancy, authz, audit, share links, cron),
the `billing` and `notifications` modules, demo sign-in (`/demo`, `DEMO_MODE=1`), `seed:demo`, clone tooling
(`new-project`, `db:setup`, `foundation:drift`, `foundation:status`, `foundation:check-modules`), and invariants INV-01 to INV-28.
