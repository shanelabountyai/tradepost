-- CreateEnum
CREATE TYPE "Party" AS ENUM ('client', 'provider');

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'disputed';

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "by" "Party" NOT NULL,
    "stars" INTEGER NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "jobId" UUID NOT NULL,
    "openedBy" "Party" NOT NULL,
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientStatement" TEXT,
    "providerStatement" TEXT,
    "resolvedAt" TIMESTAMPTZ(6),
    "resolvedBy" UUID,
    "refundCents" INTEGER,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "userId" UUID NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Review_publishedAt_idx" ON "Review"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_jobId_by_key" ON "Review"("jobId", "by");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (D-005): stars are 1..5 and a dispute's refund is non-negative cents.
ALTER TABLE "Review" ADD CONSTRAINT "Review_stars_check" CHECK ("stars" BETWEEN 1 AND 5);
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_refundCents_check" CHECK ("refundCents" >= 0);
