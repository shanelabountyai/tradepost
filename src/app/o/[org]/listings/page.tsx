import { requireOrg } from '@/core/authz/guards';
import { ActionForm } from '@/core/ui/action-form';
import { ServiceCategory } from '@/generated/prisma/enums';
import { canManage } from '@/lib/roles';
import { providerDb } from '@/lib/tenancy';
import { addListing, deleteListing, updateListing } from './actions';

export const metadata = { title: 'Listings' };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type Values = { title: string; category: string; description: string; lat: number; lng: number; radiusMiles: number; rateCents: number; days: number[] };

function Fields({ v }: { v?: Values }) {
  return (
    <>
      <label>Title <input name="title" required maxLength={120} defaultValue={v?.title} /></label>
      <label>
        Category{' '}
        <select name="category" defaultValue={v?.category}>
          {Object.values(ServiceCategory).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>Description <textarea name="description" maxLength={2000} defaultValue={v?.description} /></label>
      <fieldset>
        <legend>Service area</legend>
        <label>Latitude <input name="lat" type="number" step="any" min={-90} max={90} required defaultValue={v?.lat} /></label>
        <label>Longitude <input name="lng" type="number" step="any" min={-180} max={180} required defaultValue={v?.lng} /></label>
        <label>Radius (miles) <input name="radiusMiles" type="number" min={1} max={200} required defaultValue={v?.radiusMiles ?? 10} /></label>
      </fieldset>
      <label>Base rate ($) <input name="rate" type="number" min={1} step={1} required defaultValue={v ? v.rateCents / 100 : undefined} /></label>
      <fieldset>
        <legend>Days you work</legend>
        {DAYS.map((d, i) => (
          <label key={d}><input type="checkbox" name={`d${i}`} defaultChecked={v ? v.days.includes(i) : i > 0 && i < 6} /> {d}</label>
        ))}
      </fieldset>
    </>
  );
}

export default async function Listings({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org);
  const listings = await providerDb(ctx).listing.findMany({ orderBy: { createdAt: 'asc' } });
  const manage = canManage(ctx); // D-009: a member reads listings only
  const bind = <A extends unknown[], R>(fn: (slug: string, ...a: A) => R) => fn.bind(null, ctx.slug);

  return (
    <main>
      <h1>Listings</h1>
      {listings.map((l) => (
        <section key={l.id}>
          <h2>{l.title}</h2>
          <p>
            {l.category} · ${(l.rateCents / 100).toFixed(2)} · {l.radiusMiles} mi · {l.days.map((d) => DAYS[d]).join(' ')}
          </p>
          {manage && <>
            <details>
              <summary>Edit</summary>
              <ActionForm action={bind(updateListing)}>
                <input type="hidden" name="id" value={l.id} />
                <Fields v={l} />
                <button type="submit">Save</button>
              </ActionForm>
            </details>
            <ActionForm action={bind(deleteListing)}>
              <input type="hidden" name="id" value={l.id} />
              <button type="submit">Delete</button>
            </ActionForm>
          </>}
        </section>
      ))}

      {manage && <>
        <h2>New listing</h2>
        <ActionForm action={bind(addListing)}>
          <Fields />
          <button type="submit">Add listing</button>
        </ActionForm>
      </>}
    </main>
  );
}
