// Address → {lat, lng} via the Census Geocoder: a public, keyless U.S. government API, so there is no
// secret to provision. Swap the endpoint here if international addresses are ever needed.
const ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${ENDPOINT}?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const match = (await res.json())?.result?.addressMatches?.[0];
  if (!match) return null;
  return { lat: Number(match.coordinates.y), lng: Number(match.coordinates.x) };
}
