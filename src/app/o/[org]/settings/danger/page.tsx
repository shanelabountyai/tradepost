import { requireOrg } from '@/core/authz/guards';
import { ActionForm } from '@/core/ui/action-form';
import { destroyOrg } from './actions';

export const metadata = { title: 'Delete org' };

export default async function Danger({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org, 'org.delete');
  return (
    <main>
      <h1>Delete this org</h1>
      <p>Every row the org owns is deleted, now and for good. The audit log keeps a record that it happened.</p>
      <ActionForm action={destroyOrg.bind(null, ctx.slug)}>
        <label>
          Type <code>{ctx.slug}</code> to confirm <input name="confirm" autoComplete="off" required />
        </label>
        <button type="submit">Delete org</button>
      </ActionForm>
    </main>
  );
}
