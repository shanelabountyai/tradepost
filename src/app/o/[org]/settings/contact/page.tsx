import { requireOrg } from '@/core/authz/guards';
import { db } from '@/core/db';
import { ActionForm } from '@/core/ui/action-form';
import { canManage } from '@/lib/roles';
import { clearContactPhone, setContactPhone } from './actions';

export const metadata = { title: 'Contact number' };

export default async function Contact({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org);
  const contact = await db.orgContact.findUnique({ where: { orgId: ctx.orgId }, select: { phone: true } });
  const manage = canManage(ctx);

  return (
    <main>
      <h1>Contact number</h1>
      <p>When set, job and message notifications for this business also go out by SMS to this number.</p>
      {!manage && <p className="note">Only an owner or admin can change this.</p>}
      {manage && (
        <ActionForm action={setContactPhone.bind(null, ctx.slug)}>
          <label>Phone <input name="phone" type="tel" required placeholder="+15125550100" defaultValue={contact?.phone} /></label>
          <button type="submit">Save</button>
        </ActionForm>
      )}
      {manage && contact && (
        <ActionForm action={clearContactPhone.bind(null, ctx.slug)}>
          <button type="submit" className="danger">Turn off SMS</button>
        </ActionForm>
      )}
    </main>
  );
}
