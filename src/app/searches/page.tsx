import Link from 'next/link';
import { requireUser } from '@/core/auth/session';
import { ActionForm } from '@/core/ui/action-form';
import { listSavedSearches } from '@/lib/saved-searches';
import { deleteSavedSearch } from './actions';

export const metadata = { title: 'Saved searches' };

// P1 (F-20): a client's saved searches. A cron pass emails a new-match notice per search that turns
// up a listing since it was last checked; there is no in-app feed, only the outbox email.
export default async function SavedSearches() {
  const s = await requireUser();
  const searches = await listSavedSearches(s.userId);

  return (
    <main>
      <h1>Saved searches</h1>
      <p>We email you when a new listing matches one of these. <Link href="/search">Search</Link> and save one from the results.</p>
      {searches.length === 0 ? (
        <p>No saved searches yet.</p>
      ) : (
        <ul className="results">
          {searches.map((sr) => (
            <li key={sr.id}>
              <p className="facts">
                <strong>{sr.category}</strong>
                <span>{sr.lat.toFixed(3)}, {sr.lng.toFixed(3)}</span>
                {sr.minRating > 0 && <span>★ {sr.minRating}+</span>}
              </p>
              <ActionForm action={deleteSavedSearch}>
                <input type="hidden" name="id" value={sr.id} />
                <button type="submit" className="secondary">Remove</button>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
