'use server';
import { redirect } from 'next/navigation';
import { redeemRecoveryCode, verifyTotp } from '@/core/auth/totp';

export async function submitTotp(form: FormData) {
  if (!(await verifyTotp(String(form.get('code') ?? '')))) redirect('/login/mfa?error=1');
  redirect('/account/security');
}

export async function submitRecoveryCode(form: FormData) {
  if (!(await redeemRecoveryCode(String(form.get('code') ?? '')))) redirect('/login/mfa?error=1');
  redirect('/account/security');
}
