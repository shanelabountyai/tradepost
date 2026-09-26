/*
  Warnings:

  - Added the required column `amountCents` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('requested', 'accepted', 'declined', 'in_progress', 'completed', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('hold', 'release', 'fee', 'refund');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "amountCents" INTEGER NOT NULL,
ADD COLUMN     "closedAt" TIMESTAMPTZ(6),
ADD COLUMN     "completedAt" TIMESTAMPTZ(6),
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'requested';

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_jobId_idx" ON "LedgerEntry"("jobId");

-- CreateIndex
CREATE INDEX "Job_status_completedAt_idx" ON "Job"("status", "completedAt");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (D-004): money is positive integer cents, and the ledger is append-only.
-- TRUNCATE skips row triggers, so tests can still empty the table.
ALTER TABLE "Job" ADD CONSTRAINT "Job_amountCents_check" CHECK ("amountCents" > 0);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_amountCents_check" CHECK ("amountCents" > 0);

CREATE FUNCTION ledger_entry_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is append-only';
END;
$$;

CREATE TRIGGER "LedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_append_only();
