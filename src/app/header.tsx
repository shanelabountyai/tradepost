import Link from 'next/link';
import { signOutHere } from '@/app/account/security/actions';
import { currentSession } from '@/core/auth/session';
import { db } from '@/core/db';
import { ActionForm } from '@/core/ui/action-form';
import { NavLink } from './nav-link';

// The global header (F-03). Sign-in still lands on the template's /onboarding; this is the way out of it.
// The links render twice, once per breakpoint, and CSS hides one, so there is only ever one visible nav.
export async function SiteHeader() {
  const s = await currentSession();
  const [orgs, admin] = s
    ? await Promise.all([
        db.membership.findMany({ where: { userId: s.userId }, select: { org: { select: { slug: true, name: true } } }, orderBy: { createdAt: 'asc' } }),
        db.platformAdmin.findUnique({ where: { userId: s.userId }, select: { userId: true } }),
      ])
    : [[], null];

  const links = (
    <>
      <NavLink href="/search">Find a pro</NavLink>
      {s && <NavLink href="/jobs">Your bookings</NavLink>}
      {s && <NavLink href="/searches">Saved searches</NavLink>}
      {orgs.map(({ org }) => <NavLink key={org.slug} href={`/o/${org.slug}/jobs`} match={`/o/${org.slug}`}>{org.name}</NavLink>)}
      {admin && <NavLink href="/admin/disputes" match="/admin">Admin</NavLink>}
      {s && <NavLink href="/account/security" match="/account">Account</NavLink>}
    </>
  );
  const exit = s ? (
    <ActionForm action={signOutHere}><button type="submit" className="secondary">Sign out</button></ActionForm>
  ) : (
    <Link className="button" href="/login">Sign in</Link>
  );

  return (
    <header className="site">
      <Link href="/" className="wordmark">Tradepost</Link>
      <nav aria-label="Main" className="wide">{links}</nav>
      <div className="wide">{exit}</div>
      <details className="narrow">
        <summary>Menu</summary>
        <nav aria-label="Main">{links}{exit}</nav>
      </details>
    </header>
  );
}
