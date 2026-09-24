import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceClock, now } from '@/core/clock';
import { log } from '@/core/log';

afterEach(() => {
  advanceClock(0);
  vi.restoreAllMocks();
});

describe('clock', () => {
  it('advances', () => {
    const before = now().getTime();
    advanceClock(60_000);
    expect(now().getTime() - before).toBeGreaterThanOrEqual(60_000);
  });
});

describe('log', () => {
  it('writes one JSON line', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log('x.happened', { n: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0]![0])).toMatchObject({ event: 'x.happened', n: 1 });
  });
});
