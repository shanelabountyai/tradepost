// Stubs address -> point so no test needs network access. tests/unit/geocode.test.ts calls vi.unmock
// to exercise the real Census-geocoder call against a mocked fetch instead.
import { vi } from 'vitest';

vi.mock('@/lib/geocode', () => ({ geocode: vi.fn(async () => ({ lat: 30.2672, lng: -97.7431 })) }));
