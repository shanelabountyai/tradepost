// One JSON line per event. Callers pass ids and counts — never bodies, tokens or emails.
export function log(event: string, fields: Record<string, string | number | boolean | null> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}
