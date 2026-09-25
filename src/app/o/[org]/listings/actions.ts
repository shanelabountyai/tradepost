'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/core/audit';
import { orgAction, ref } from '@/core/authz/action';
import { notFoundOnP2025, type OrgCtx } from '@/core/authz/guards';
import { Refused } from '@/core/errors';
import { ServiceCategory } from '@/generated/prisma/enums';
import { providerDb } from '@/lib/tenancy';

// P0-2: a provider's own listings. Every query goes through providerDb, so a foreign id is notFound.
const page = (ctx: OrgCtx) => `/o/${ctx.slug}/listings`;

// FormData keeps only the last value of a repeated name, so each weekday is its own checkbox: d0 = Sunday.
type Day = `d${0 | 1 | 2 | 3 | 4 | 5 | 6}`;
const dayFields = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [`d${d}`, z.literal('on').optional()])) as Record<Day, z.ZodOptional<z.ZodLiteral<'on'>>>;

const listing = z
  .object({
    title: z.string().trim().min(1, 'Give the listing a title.').max(120),
    category: z.enum(ServiceCategory),
    description: z.string().trim().max(2000).default(''),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusMiles: z.coerce.number().int().min(1, 'The service radius is at least 1 mile.').max(200),
    rate: z.coerce.number().int('Whole dollars only.').min(1, 'The base rate is at least $1.').max(100_000),
    ...dayFields,
  })
  .refine((i) => Object.keys(dayFields).some((d) => i[d as Day]), 'Pick at least one day you work.');

const toData = ({ rate, ...i }: z.infer<typeof listing>) => ({
  title: i.title, category: i.category, description: i.description, lat: i.lat, lng: i.lng, radiusMiles: i.radiusMiles,
  rateCents: rate * 100,
  days: [0, 1, 2, 3, 4, 5, 6].filter((d) => i[`d${d}` as Day]),
});

export const addListing = orgAction(null, listing, async (ctx, i) => {
  const l = await providerDb(ctx).listing.create({ data: { ...toData(i), orgId: ctx.orgId } });
  await audit(ctx, 'listing.created', { targetType: 'listing', targetId: l.id });
  redirect(page(ctx));
});

export const updateListing = orgAction(null, listing.and(z.object({ id: ref('listing') })), async (ctx, i) => {
  await providerDb(ctx).listing.update({ where: { id: i.id }, data: toData(i) }).catch(notFoundOnP2025);
  await audit(ctx, 'listing.updated', { targetType: 'listing', targetId: i.id });
  redirect(page(ctx));
});

export const deleteListing = orgAction(null, z.object({ id: ref('listing') }), async (ctx, { id }) => {
  await providerDb(ctx)
    .listing.delete({ where: { id } })
    .catch((e) => {
      if (e?.code === 'P2003') throw new Refused('This listing has jobs, so it cannot be deleted.');
      return notFoundOnP2025(e);
    });
  await audit(ctx, 'listing.deleted', { targetType: 'listing', targetId: id });
  redirect(page(ctx));
});
