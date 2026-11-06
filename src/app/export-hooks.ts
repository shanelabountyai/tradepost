import { moduleExportTables } from '@/app/modules';
import type { ExportTable } from '@/core/tenancy/export';
import { providerExportTables } from '@/lib/tenancy';

// Clone-owned (v1.6.0), like org-hooks.ts: which tables a data export holds beyond the template's core ones
// (addendum §5). Add one entry per org-owned table, selecting only columns that are safe to hand over: never a
// sealed column, token hash or recovery code (INV-34 scans the output). Every query runs inside withOrg.
//   { name: 'Booking', rows: (tx, orgId) => tx.booking.findMany({ where: { orgId }, select: { id: true, startsAt: true } }) },
export const exportTables: readonly ExportTable[] = [
  ...moduleExportTables,
  // Tradepost (v1.6.0): the provider org's own rows. No secret, hash or token columns exist on these models.
  // Listing and Job are provider-owned (P0-1), so they live in the tenancy layer.
  ...providerExportTables,
  { name: 'OrgContact', rows: (tx, orgId) => tx.orgContact.findMany({ where: { orgId }, select: { orgId: true, phone: true } }) },
  { name: 'ProviderRating', rows: (tx, orgId) => tx.providerRating.findMany({ where: { orgId }, select: { orgId: true, count: true, sum: true } }) },
];

// An org-owned table left out on purpose, with the reason. INV-34 fails on any model with an orgId column that is in
// neither list, so a new table cannot silently drop out of every export.
export const exportSkipped: Readonly<Record<string, string>> = {};
