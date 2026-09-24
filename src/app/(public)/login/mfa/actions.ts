'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { redeemRecoveryCode, verifyTotp } from '@/core/auth/totp';
import { userAction } from '@/core/authz/action';

const code = z.object({ code: z.string() });

export const submitTotp = userAction(code, async (_, i) => redirect((await verifyTotp(i.code)) ? '/onboarding' : '/login/mfa?error=1'), { allowPendingMfa: true });

export const submitRecoveryCode = userAction(code, async (_, i) => redirect((await redeemRecoveryCode(i.code)) ? '/onboarding' : '/login/mfa?error=1'), {
  allowPendingMfa: true,
});
