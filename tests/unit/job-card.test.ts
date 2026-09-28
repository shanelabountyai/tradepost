import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Money } from '@/app/jobs/card';
import { ledgerRows } from '@/lib/jobs';

// D-011: the fee sentence on the job card is read from the same ledger rows the money moved by.
const text = (props: Parameters<typeof Money>[0]) => renderToStaticMarkup(createElement(Money, props)).replace(/<[^>]+>/g, ' ');
const hold = [{ kind: 'hold' as const, amountCents: 18_500 }];

describe('job card money line', () => {
  it('a request holds nothing yet', () => {
    expect(text({ status: 'requested', amountCents: 18_500, ledger: [], side: 'client', other: 'Brightline' })).toContain('Held when Brightline accepts. $185.00 = $166.50 to the pro + $18.50 service fee');
  });
  it('held money shows the projected net for the provider', () => {
    expect(text({ status: 'accepted', amountCents: 18_500, ledger: hold, side: 'provider', other: 'c@x' })).toContain('$166.50 to you after the $18.50 service fee, once released.');
  });
  it('a full refund has no fee', () => {
    const ledger = [...hold, ...ledgerRows('refund', 18_500)];
    expect(text({ status: 'cancelled', amountCents: 18_500, ledger, side: 'client', other: 'B' })).toContain('Refunded in full. No service fee.');
  });
  it('a split takes the fee on the released part only', () => {
    const ledger = [...hold, ...ledgerRows('split', 18_500, 7_400)];
    expect(text({ status: 'closed', amountCents: 18_500, ledger, side: 'client', other: 'B' })).toContain(
      '$185.00 = $74.00 refunded to you + $99.90 to the pro + $11.10 service fee on the $111.00 released.',
    );
  });
});
