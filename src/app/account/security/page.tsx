import Link from 'next/link';
import { requireUser } from '@/core/auth/session';
import { pendingEnrolment } from '@/core/auth/totp';
import { signOutAll, signOutHere, startEnrol, turnOffTotp } from './actions';
import { ConfirmForm } from './confirm-form';

export const metadata = { title: 'Security' };

export default async function Security({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await requireUser();
  const pending = await pendingEnrolment(s);
  const { error } = await searchParams;
  return (
    <main>
      <h1>Security</h1>
      <p>Signed in as {s.email}</p>
      {error === 'reauth' && (
        <p role="alert">For this change, <Link href="/login">sign in again</Link> first. Links count as recent for 5 minutes.</p>
      )}

      <h2>Two-factor sign-in</h2>
      {pending ? (
        <>
          <p>Add this key to your authenticator app, then enter the code it shows.</p>
          <p><code>{pending.secret}</code></p>
          <p><a href={pending.uri}>Open in authenticator app</a></p>
          <ConfirmForm />
        </>
      ) : (
        <>
          <p>{s.totpEnrolled ? 'On.' : 'Off.'}</p>
          <form action={startEnrol}>
            <button type="submit">{s.totpEnrolled ? 'Move to a new device' : 'Turn on'}</button>
          </form>
          {s.totpEnrolled && (
            <form action={turnOffTotp}>
              <button type="submit">Turn off</button>
            </form>
          )}
        </>
      )}

      <h2>Sessions</h2>
      <form action={signOutHere}>
        <button type="submit">Sign out</button>
      </form>
      <form action={signOutAll}>
        <button type="submit">Sign out everywhere</button>
      </form>
    </main>
  );
}
