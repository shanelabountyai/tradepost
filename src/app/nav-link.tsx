'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** A header link that marks itself current when the path is under `match` (default: its href). */
export function NavLink({ href, match = href, children }: { href: string; match?: string; children: React.ReactNode }) {
  const path = usePathname();
  const current = path === match || path.startsWith(`${match}/`);
  return <Link href={href} aria-current={current ? 'page' : undefined}>{children}</Link>;
}
