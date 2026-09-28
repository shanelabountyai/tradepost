// Clone-owned, like cron-jobs.ts and org-hooks.ts: modules this clone's own code depends on
// outside the marked lines (an import `foundation:check-modules` wouldn't otherwise see coming).
// foundation:check-modules leaves these in place and still removes the rest.
// notifications: src/lib/notify.ts (job/message emails) imports the outbox outside any marked line.
export const REQUIRED_MODULES: string[] = ['notifications'];
