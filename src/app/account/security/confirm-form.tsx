'use client';
import { useActionState } from 'react';
import { finishEnrol } from './actions';

// Client-side only so the recovery codes can be shown once without ever landing in a URL or cookie.
export function ConfirmForm({ pending: enrolling }: { pending: boolean }) {
  const [state, action, pending] = useActionState(async (_: unknown, form: FormData) => finishEnrol(form), null);
  if (state && 'codes' in state && state.codes) {
    return (
      <section>
        <h2>Save your recovery codes</h2>
        <p>Each one works once if you lose your device. They will not be shown again.</p>
        <ul>{state.codes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
        <a href="/onboarding">Done</a>
      </section>
    );
  }
  if (!enrolling) return null;
  return (
    <form action={action}>
      {state?.error && <p role="alert">{state.error}</p>}
      <label>
        Code from your app <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
      </label>
      <button type="submit" disabled={pending}>Turn on</button>
    </form>
  );
}
