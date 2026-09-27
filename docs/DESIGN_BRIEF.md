# Tradepost: design brief

This is the input for a Claude Design pass. Paste the whole file in. The output is implemented in this repo afterwards.

## The product in one paragraph

Tradepost is a two-sided marketplace for home services. A **client** searches for a local pro (plumbing, cleaning
and similar trades) and requests a job. A **provider** (a small trade business) accepts it, and Tradepost **holds the
payment** until the work is done. The pro can never release their own money. Only the client's confirmation
releases it, or an automatic confirm 72 hours after the pro marks the job complete. If something goes wrong, either
side opens a **dispute**, the money freezes, and an **admin** splits or returns it. Reviews are **blind**: neither side
sees the other's review until both are in or 14 days pass. All data is synthetic, and this is a portfolio demo.

**The design has one job: make the money legible.** Every screen that touches a job should answer at a glance *where
the money is right now* (held, frozen, refunded, paid out) and *whose move it is*. Trust is the product.

## Who uses it

| Person | Where they live | What they need to see first |
|---|---|---|
| Client (homeowner) | `/search`, `/jobs` | Is my money safe, what do I do next, when does it auto-confirm |
| Provider owner | `/o/[org]/jobs`, `/o/[org]/listings` | New requests to accept, what's held for me, when I get paid |
| Admin (ops) | `/admin/disputes` | Both statements side by side, the frozen amount, the split control |

## Screens to design (priority order)

0. **A signed-in header (global nav).** There is no nav today. A client who signs in lands on the template's
   "Your orgs" page (`/onboarding`), whose only link loops back to itself, and has to type `/search` or `/jobs` by hand.
   Design one header for the root layout: wordmark → `/`, *Find a pro* (`/search`), *Your bookings* (`/jobs`), the
   user's provider org(s) when they have one (`/o/[org]/jobs`), *Admin* for admins, *Account*, and *Sign out*. It must
   work at 360px. The sign-in redirect to `/onboarding` is template-owned and stays, so the header is the way out, and
   `/onboarding` must read as a fine page for a client too, through global styles only.
1. **Client bookings (`/jobs`).** This is the hero screen. A list of job cards shows the listing title, provider,
   date, amount, a **status** pill and an **escrow line** (held / refunded / paid to the pro).
   **Show the platform fee.** The ledger takes a 10% fee, and today the client sees "$185.00 held" and later "$166.50
   paid to the pro" with nothing explaining the $18.50. Break it down at booking and on the closed job, e.g.
   "$185.00 = $166.50 to the pro + $18.50 service fee". The fee is 10% of what is *released*, so a full refund has
   no fee, and a split shows three parts (refunded to you, to the pro, service fee on the released part). Each status gets one
   primary action: *Withdraw request*, *Cancel (full refund)* or *Confirm the work is done (releases payment)*.
   A completed job shows "Confirms automatically <datetime>". Three collapsible panels sit below each card:
   **Dispute** (write a statement → *Open a dispute*), **Review** (1–5 stars + text, blind), and **Message thread**
   (polling chat). Messages are allowed in every status, so on a declined, cancelled or closed job the thread stays
   open but must say the job is over (e.g. "This job is closed. Messages are kept for the record.").
2. **Provider jobs (`/o/[org]/jobs`).** The same card anatomy seen from the other side, with actions *Accept*,
   *Decline*, *Start* and *Mark complete*, and the same dispute, review and thread panels. The provider must never see
   a button that looks like it releases money. Show the provider their net ("$166.50 to you after the $18.50 fee").
   **Two roles see this page.** An owner or admin gets the actions. A `member` (the tech on site) reads jobs and can
   message, but every money or status action is hidden. Today nothing explains the missing buttons; design a quiet
   read-only notice ("You can view jobs and message clients. The owner accepts, completes and disputes jobs.").
3. **Search (`/search`).** A form with category, latitude, longitude and date. (Location is typed coordinates for now.
   Design a location field that could later take an address, but keep lat/lng inputs working.) Results are ranked by
   distance and rating. Each result shows title, provider, base rate, rating, distance, and a **Request for <date>**
   button. If the client already has a live request with that pro for that date, the database refuses a duplicate
   ("You already requested this pro for that date."). Design an **already requested** state on the result instead of
   letting them hit the error: the button is replaced by a status and a link to the booking.
4. **Admin dispute queue (`/admin/disputes`).** One card per dispute: client statement and provider statement side
   by side, the **frozen amount**, a *Read the message thread* link (the read is audit-logged, so say so in the UI),
   and a split form (*refund $___* → *Resolve with split*, plus full refund and full release). Two disputes for the
   same client, pro and date look identical today, so each card needs a **short job id** (e.g. `#a3f9c1`) and the
   **amount**. Below the open queue sits a **Resolved** list (no statements, just job id, parties, amount, the split,
   the date) linking to a case page that shows the thread, both statements and the resolution. Reading it is also
   audit-logged.
5. **Provider listings (`/o/[org]/listings`).** A CRUD form: title, description, category, base rate ($), latitude,
   longitude, radius (miles), availability by weekday. It has *Add listing*, *Save* and *Delete*. A `member` sees the
   listings read-only, with the same kind of notice as on jobs.
6. **Home (`/`).** Its `<h1>` and `<title>` still say "SaaS Foundation" with three links, and that has to go. Design a
   simple landing: what Tradepost is, *Find a pro*, *Sign in*, and *Demo accounts* when demo mode is on.
7. **Everything else** (login, demo account picker, onboarding, account security, org settings, legal, shared
   link). These are template-owned and **cannot be edited**. They must look right through the global styles alone.

## States that must be designed, not left to chance

- **Job status** (the pill and the escrow line): `requested`, `accepted`, `declined`, `in_progress`, `completed`
  (the pro says it's done and the client hasn't confirmed yet), `disputed`, `closed` (confirmed, auto-confirmed or
  resolved, with money paid out) and `cancelled` (which includes a withdrawn request). Give each a colour *and* a
  text/icon, never colour alone.
- **Escrow line** combinations: nothing held yet → held → frozen (disputed) → released / refunded / split (both).
- **Blind review:** "You've reviewed; theirs appears when they submit or on <date>" versus both published.
- **Fee breakdown:** held (total only), closed (to the pro + service fee), refunded, split.
- **Role:** owner/admin versus read-only `member` on provider pages.
- **Search result:** requestable versus already requested.
- **Dead job thread:** open thread with a closed label on declined, cancelled and closed jobs.
- **Empty states:** no bookings yet, no search results, *No open disputes*, no listings.
- **Errors from actions:** `ActionForm` renders a server error inline under the form. Style it.
- **404:** another provider's page is a 404 on purpose (tenant isolation). It should look like a normal not-found.

## Hard constraints for the implementation

- **One global stylesheet, no UI library.** Nothing is styled today and no CSS framework is installed. Plan the design
  as CSS custom properties (tokens) plus element and class styles in a single `src/app/globals.css` imported by the
  root layout. That is the only way template-owned pages pick it up without being edited.
- **Style semantic HTML first.** Pages use `main`, `h1`, `h2`, `section` (one per job card), `p`, `form`,
  `label > input`, `button`, `details/summary` (the panels) and `footer`. A few classes may be added to clone-owned
  pages (`/jobs`, `/o/[org]/jobs`, `/o/[org]/listings`, `/search`, `/admin/disputes`, `/`), but the design must still
  hold up with **zero classes**.
- **Money is shown as `$185.00`**, always two decimals, tabular figures.
- **Light and dark**, via tokens under `prefers-color-scheme`.
- **Mobile first**: 360px wide with no horizontal scroll. Providers use this from a truck.
- **Accessibility:** AA contrast, visible focus rings, 44px touch targets, and status never shown by colour alone.
- **No images or illustrations required.** A wordmark and system or Google fonts are enough.

## Out of scope (P1, cut on purpose)

Do not design saved searches, the earnings dashboard, review moderation, cancellation fees, maps, photos or payments
UI (card entry). Those features do not exist.

## What I want back from Claude Design

1. A token sheet: colour (including one colour per job-status family: pending, active, money-held, frozen, done,
   ended), type scale, spacing, radius, shadow.
2. Mockups of screens 0–4 at mobile and desktop width (including the resolved-dispute case page), plus the home page.
3. The job card as a component with every status variant on one board.
4. Notes on anything in the flows above that the design suggests changing (wording, action order).

## How it gets implemented (for the build session, not for Claude Design)

`globals.css` goes in first, imported from `src/app/layout.tsx`, and the metadata title changes to *Tradepost*.
The header goes in `src/app/layout.tsx` (clone-owned; `src/app/o/[org]/layout.tsx` already has a partial org nav to
fold in). Then the home page, then light classes on the five clone-owned pages. After that: `npm run foundation:drift` (no
template path touched), `npm run test:e2e`, and a screenshot pass at 360px and 1280px in both themes.
