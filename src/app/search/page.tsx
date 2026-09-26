import { z } from 'zod';
import { requestJob } from '@/app/jobs/actions';
import { now } from '@/core/clock';
import { ActionForm } from '@/core/ui/action-form';
import { ServiceCategory } from '@/generated/prisma/enums';
import { rankListings, weekday } from '@/lib/search';
import { searchableListings } from '@/lib/tenancy';

export const metadata = { title: 'Find a pro' };
export const dynamic = 'force-dynamic';

// P0-2 client search: a plain GET form, so a search is a shareable URL and needs no action.
// ponytail: location is typed as lat/lng; a geocoder (address → point) replaces the two inputs when a demo needs it.
const query = z.object({
  category: z.enum(ServiceCategory),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  date: z.iso.date(),
  minRating: z.coerce.number().min(0).max(5).default(0),
});

export default async function Search({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = query.safeParse(raw);
  const results = q.success
    ? rankListings(
        (await searchableListings({ category: q.data.category, weekday: weekday(q.data.date) })).map((l) => ({ ...l, rating: l.org.rating })),
        q.data,
        q.data.minRating,
      )
    : null;
  const v = (k: string) => (typeof raw[k] === 'string' ? raw[k] : undefined);

  return (
    <main>
      <h1>Find a pro</h1>
      <form method="get">
        <label>
          Service{' '}
          <select name="category" defaultValue={v('category')}>
            {Object.values(ServiceCategory).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Latitude <input name="lat" type="number" step="any" min={-90} max={90} required defaultValue={v('lat')} /></label>
        <label>Longitude <input name="lng" type="number" step="any" min={-180} max={180} required defaultValue={v('lng')} /></label>
        <label>Date <input name="date" type="date" required defaultValue={v('date') ?? now().toISOString().slice(0, 10)} /></label>
        <label>
          Minimum rating{' '}
          <select name="minRating" defaultValue={v('minRating') ?? '0'}>
            {[0, 3, 3.5, 4, 4.5].map((r) => <option key={r} value={r}>{r ? `${r}+` : 'Any'}</option>)}
          </select>
        </label>
        <button type="submit">Search</button>
      </form>

      {results && (results.length ? (
        <ol>
          {results.map((l) => (
            <li key={l.id}>
              <h2>{l.title}</h2>
              <p>
                {l.org.name} · ${(l.rateCents / 100).toFixed(2)} ·{' '}
                {l.ratingCount ? `${l.ratingMean.toFixed(1)}★ (${l.ratingCount})` : 'No reviews yet'} · {l.distanceMiles.toFixed(1)} mi away
              </p>
              {l.description && <p>{l.description}</p>}
              <ActionForm action={requestJob}>
                <input type="hidden" name="listingId" value={l.id} />
                <input type="hidden" name="date" value={q.data!.date} />
                <button type="submit">Request for {q.data!.date}</button>
              </ActionForm>
            </li>
          ))}
        </ol>
      ) : <p>No pros match. Try another date, or a lower minimum rating.</p>)}
      {raw.category && !q.success && <p role="alert">{q.error.issues[0]?.message}</p>}
    </main>
  );
}
