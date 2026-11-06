import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

// M11 gate (addendum §4, §5): the audit log, org security, account sessions and export pages render for each demo org.
// The export itself is refused here (a demo account is shared); INV-34 builds and verifies one against its manifest.
// Tradepost: seeded as a child process like demo.spec.ts (importing the seed pulls in `next/navigation`), with
// tradepost's demo providers. Its seed sets no AI cap, so the template's "$1.00 limit" line is not asserted.
test.beforeAll(() => { execSync('npm run seed:demo:test', { stdio: 'ignore' }); });

for (const [slug, name] of [['brightline', 'Brightline Plumbing'], ['fernway', 'Fernway Cleaning']] as const) {
  test(`settings pages render for the ${name} demo owner`, async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: `owner@${slug}.demo.test` }).click();
    await page.getByRole('main').getByRole('link', { name }).click();
    const nav = page.getByRole('navigation', { name: 'Business' });

    await nav.getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download CSV' })).toBeVisible();

    await nav.getByRole('link', { name: 'Security' }).click();
    await expect(page.getByRole('heading', { name: 'Org security' })).toBeVisible();
    await expect(page.getByRole('cell', { name: `owner@${slug}.demo.test` })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI spending' })).toBeVisible();
    await page.getByRole('button', { name: 'Save limit' }).click();
    await expect(page.getByText('This is a shared demo account')).toBeVisible();

    await nav.getByRole('link', { name: 'Export or delete' }).click();
    await expect(page.getByRole('heading', { name: 'Export this org' })).toBeVisible();
    await page.getByRole('button', { name: 'Export data' }).click();
    await expect(page.getByText('This is a shared demo account')).toBeVisible();

    await page.goto('/account/security');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByText('This session')).toBeVisible();
  });
}
