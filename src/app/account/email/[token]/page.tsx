import { requireUser } from '@/core/auth/session';
import { ActionForm } from '@/core/ui/action-form';
import { confirmEmail } from './actions';

export const metadata = { title: 'Confirm email', robots: { index: false } };

// GET renders a button and spends nothing (INV-17 pattern); the POST confirms for the signed-in user.
export default async function ConfirmEmail({ params }: { params: Promise<{ token: string }> }) {
  await requireUser();
  const { token } = await params;
  return (
    <main>
      <h1>Confirm your new email address</h1>
      <ActionForm action={confirmEmail}>
        <input type="hidden" name="token" value={token} />
        <button type="submit">Confirm</button>
      </ActionForm>
    </main>
  );
}
