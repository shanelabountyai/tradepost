'use client';
import { useActionState } from 'react';

/**
 * The one form for orgAction/userAction exports: shows the `{ error }` a refused action returns,
 * and disables itself while pending. Pass a bound action for org routes: `setRole.bind(null, slug)`.
 */
export function ActionForm({ action, children }: { action: (form: FormData) => Promise<unknown>; children: React.ReactNode }) {
  const [state, submit, pending] = useActionState(async (_: unknown, form: FormData) => action(form), null);
  const error = state && typeof state === 'object' && 'error' in state ? String(state.error) : null;
  return (
    <form action={submit}>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={pending} style={{ border: 0, margin: 0, padding: 0 }}>
        {children}
      </fieldset>
    </form>
  );
}
