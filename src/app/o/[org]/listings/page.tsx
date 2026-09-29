import { requireOrg } from '@/core/authz/guards';
import { ActionForm } from '@/core/ui/action-form';
import { ServiceCategory } from '@/generated/prisma/enums';
import { canManage } from '@/lib/roles';
import { providerDb } from '@/lib/tenancy';
import { addListing, deleteListing, updateListing } from './actions';

export const metadata = { title: 'Listings' };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type Values = {
  title: string; category: string; description: string; address: string | null; lat: number; lng: number;
  radiusMiles: number; rateCents: number; days: number[];
};

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
        <label>
          Address <input name="address" required maxLength={200} placeholder="123 Main St, Austin TX 78701" defaultValue={v?.address ?? undefined} />
        </label>
        {v && <p className="note">Current location: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}</p>}
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
      {!manage && <p className="note">You can view listings. The owner adds, edits and deletes them.</p>}
      {manage && !listings.length && (
        <section className="empty">
          <h2>No listings yet</h2>
          <p>Clients can&apos;t find you until you add one. Use the form below.</p>
        </section>
      )}
      {listings.map((l) => (
        <section key={l.id}>
          <h2>{l.title}</h2>
          <p className="sub">
            {l.category} · ${(l.rateCents / 100).toFixed(2)} base rate · {l.radiusMiles} mi radius · {l.days.map((d) => DAYS[d]).join(' ')}
          </p>
          {l.description && <p>{l.description}</p>}
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
              <button type="submit" className="danger">Delete</button>
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
