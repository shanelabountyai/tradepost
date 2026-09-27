-- Hand-written (D-009, F-02): one live job per client, listing and date. Declined, cancelled and closed
-- jobs do not count, so a client can re-request after any of those. Prisma cannot express a partial
-- index; if `migrate dev` ever proposes dropping "Job_one_active_per_date", keep it.
CREATE UNIQUE INDEX "Job_one_active_per_date" ON "Job" ("clientId", "listingId", "date")
  WHERE "status" IN ('requested', 'accepted', 'in_progress', 'completed', 'disputed');
