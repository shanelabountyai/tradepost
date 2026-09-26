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

1. **Client bookings (`/jobs`).** This is the hero screen. A list of job cards shows the listing title, provider,
   date, amount, a **status** pill and an **escrow line** (held / refunded / paid to the pro). Each status gets one
   primary action: *Withdraw request*, *Cancel (full refund)* or *Confirm the work is done (releases payment)*.
   A completed job shows "Confirms automatically <datetime>". Three collapsible panels sit below each card:
   **Dispute** (write a statement → *Open a dispute*), **Review** (1–5 stars + text, blind), and **Message thread**
   (polling chat).
2. **Provider jobs (`/o/[org]/jobs`).** The same card anatomy seen from the other side, with actions *Accept*,
   *Decline*, *Start* and *Mark complete*, and the same dispute, review and thread panels. The provider must never see
   a button that looks like it releases money.
3. **Search (`/search`).** A form with category, latitude, longitude and date. (Location is typed coordinates for now.
   Design a location field that could later take an address, but keep lat/lng inputs working.) Results are ranked by
   distance and rating. Each result shows title, provider, base rate, rating, distance, and a **Request for <date>**
   button.
4. **Admin dispute queue (`/admin/disputes`).** One card per dispute: client statement and provider statement side
   by side, the **frozen amount**, a *Read the message thread* link (the read is audit-logged, so say so in the UI),
   and a split form (*refund $___* → *Resolve with split*, plus full refund and full release).
5. **Provider listings (`/o/[org]/listings`).** A CRUD form: title, description, category, base rate ($), latitude,
   longitude, radius (miles), availability by weekday. It has *Add listing*, *Save* and *Delete*.
6. **Home (`/`).** It currently says "SaaS Foundation" with three links, and that has to go. Design a simple landing:
   what Tradepost is, *Find a pro*, *Sign in*, and *Demo accounts* when demo mode is on.
7. **Everything else** (login, demo account picker, onboarding, account security, org settings, legal, shared
   link). These are template-owned and **cannot be edited**. They must look right through the global styles alone.

## States that must be designed, not left to chance

- **Job status** (the pill and the escrow line): `requested`, `accepted`, `declined`, `in_progress`, `completed`
  (the pro says it's done and the client hasn't confirmed yet), `disputed`, `closed` (confirmed, auto-confirmed or
  resolved, with money paid out) and `cancelled` (which includes a withdrawn request). Give each a colour *and* a
  text/icon, never colour alone.
- **Escrow line** combinations: nothing held yet → held → frozen (disputed) → released / refunded / split (both).
- **Blind review:** "You've reviewed; theirs appears when they submit or on <date>" versus both published.
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
2. Mockups of screens 1–4 at mobile and desktop width, plus the home page.
3. The job card as a component with every status variant on one board.
4. Notes on anything in the flows above that the design suggests changing (wording, action order).

## How it gets implemented (for the build session, not for Claude Design)

`globals.css` goes in first, imported from `src/app/layout.tsx`, and the metadata title changes to *Tradepost*.
Then the home page, then light classes on the five clone-owned pages. After that: `npm run foundation:drift` (no
template path touched), `npm run test:e2e`, and a screenshot pass at 360px and 1280px in both themes.
