// The one source of "now", so tests can pin time instead of sleeping.
let offsetMs = 0;

export const now = () => new Date(Date.now() + offsetMs);

/** Test-only: shift the clock; call with 0 to reset. */
export const advanceClock = (ms: number) => {
  offsetMs = ms;
};
