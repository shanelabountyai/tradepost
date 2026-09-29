'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ref, userAction } from '@/core/authz/action';
import { ServiceCategory } from '@/generated/prisma/enums';
import { createSavedSearch, removeSavedSearch } from '@/lib/saved-searches';

// P1 (F-20): a client's saved searches. Every action goes through userAction, scoped to the signed-in
// user (never a foreign id) — same shape as the client side of a job (src/app/jobs/actions.ts).
const where = { error: 'That location is not valid.' };
const stars = { error: 'Pick a rating from 0 to 5.' };

export const saveSearch = userAction(
  z.object({
    category: z.enum(ServiceCategory, { error: 'Pick a service.' }),
    lat: z.coerce.number(where).min(-90, where).max(90, where),
    lng: z.coerce.number(where).min(-180, where).max(180, where),
    minRating: z.coerce.number(stars).min(0, stars).max(5, stars).default(0),
  }),
  async (s, i) => {
    await createSavedSearch(s.userId, i);
    redirect('/searches');
  },
);

export const deleteSavedSearch = userAction(z.object({ id: ref('savedSearch') }), async (s, { id }) => {
  await removeSavedSearch(s.userId, id);
  redirect('/searches');
});
