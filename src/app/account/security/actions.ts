'use server';
import { redirect } from 'next/navigation';
import { ReauthRequired, requireUser, signOut, signOutEverywhere } from '@/core/auth/session';
import { confirmTotp, disableTotp, enrolTotp } from '@/core/auth/totp';

// Thin calls into core (D-12). Each core function checks the session itself.
const reauthOr = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ReauthRequired) redirect('/account/security?error=reauth');
    throw e;
  }
};

export async function startEnrol() {
  await reauthOr(enrolTotp);
  redirect('/account/security');
}

export async function finishEnrol(_: unknown, form: FormData): Promise<{ codes?: string[]; error?: string }> {
  const codes = await confirmTotp(String(form.get('code') ?? ''));
  return codes ? { codes } : { error: 'That code did not match. Try the next one from your app.' };
}

export async function turnOffTotp() {
  await reauthOr(disableTotp);
  redirect('/account/security');
}

export async function signOutHere() {
  await signOut();
  redirect('/login');
}

export async function signOutAll() {
  await signOutEverywhere((await requireUser()).userId);
  redirect('/login');
}
