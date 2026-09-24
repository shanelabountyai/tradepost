// Templates are code, not rows: a template name in the outbox is looked up here at drain time, so
// a copy fix reaches messages that are still queued. Add one entry per message; `data` is the
// JSON stored on the row, so keep it to plain strings and never put a secret in it (rows are
// readable to anyone with database access).
export type Rendered = { subject: string; body: string };

export const templates: Record<string, (data: Record<string, unknown>) => Rendered> = {
  notice: (d) => ({ subject: String(d.subject ?? 'Notice'), body: String(d.body ?? '') }),
};

export function render(template: string, data: unknown): Rendered {
  const t = templates[template];
  if (!t) throw new Error(`Unknown notification template: ${template}`);
  return t((data ?? {}) as Record<string, unknown>);
}
