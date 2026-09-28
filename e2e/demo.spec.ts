import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

// INV-27, flag-on half (the flag-off half is tests/invariants/inv-27-demo.test.ts). playwright.config.ts starts the
// server with DEMO_MODE=1; this spec seeds the same database itself. Run as a child process: importing the seed
// pulls in `@/lib/jobs` → `next/navigation`, which Playwright's ESM loader cannot resolve.
test.beforeAll(() => { execSync('npm run seed:demo:test', { stdio: 'ignore' }); });

test('demo sign-in lands a seeded owner in their org', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'owner@brightline.demo.test' }).click();
  await expect(page.getByRole('heading', { name: 'Your orgs' })).toBeVisible();
  // Scoped: the global header (D-011) also links each org, and the org pages carry a second nav.
  await page.getByRole('main').getByRole('link', { name: 'Brightline Plumbing' }).click();
  await expect(page.getByRole('navigation', { name: 'Business' })).toContainText('Brightline Plumbing');
});
