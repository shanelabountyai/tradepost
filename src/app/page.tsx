// public: the landing page
import Link from 'next/link';
import { demoEnabled } from '@/core/auth/demo';

export const dynamic = 'force-dynamic'; // reads DEMO_MODE per request, never baked in at build

export default function Home() {
  return (
    <main>
      <div className="hero">
        <h1>Book a local pro. Pay when the work is done.</h1>
        <p>
          Tradepost holds your payment while the job happens. The pro is paid when you confirm the work, or
          automatically 72 hours after they mark it complete. If something goes wrong, the money freezes until
          an admin sorts it out.
        </p>
        <div className="actions">
          <Link className="button" href="/search">Find a pro</Link>
          <Link className="button secondary" href="/login">Sign in</Link>
          {demoEnabled() && <Link className="button secondary" href="/demo">Demo accounts</Link>}
        </div>
      </div>
      <ol className="steps">
        <li><strong>Request</strong>Pick a pro and a date. Nothing is charged until they accept.</li>
        <li><strong>Held</strong>When they accept, Tradepost holds the payment. The pro can’t release it.</li>
        <li><strong>Released</strong>You confirm the work, and the pro is paid less a 10% service fee.</li>
      </ol>
      <p className="hint">A portfolio demo. Every person, business and payment here is synthetic.</p>
      <footer>
        <Link href="/legal/privacy">Privacy</Link> <Link href="/legal/terms">Terms</Link>
      </footer>
    </main>
  );
}
