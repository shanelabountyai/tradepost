import { requireUser } from '@/core/auth/session';
import { ActionForm } from '@/core/ui/action-form';
import { joinOrg } from '../../actions';

export const metadata = { title: 'Accept invite', robots: { index: false } };

// GET looks nothing up and spends nothing; the POST checks the token against the signed-in
// user's address. Signed out, the guard sends them to /login; they open this link again after.
// ponytail: the link is not carried through sign-in; add a `next` hop if the second click annoys.
export default async function AcceptInvite({ params }: { params: Promise<{ token: string }> }) {
  const s = await requireUser();
  const { token } = await params;
  return (
    <main>
      <h1>Join an org</h1>
      <p>Signed in as {s.email}. The invite must be addressed to this email.</p>
      <ActionForm action={joinOrg}>
        <input type="hidden" name="token" value={token} />
        <button type="submit">Accept invite</button>
      </ActionForm>
    </main>
  );
}
