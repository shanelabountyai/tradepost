-- D-024 (F-16): reported reviews and their moderation.
ALTER TABLE "Review" ADD COLUMN "reportedAt" TIMESTAMPTZ(6),
ADD COLUMN "reportReason" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMPTZ(6),
ADD COLUMN "moderatedBy" UUID,
ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Review_reportedAt_idx" ON "Review"("reportedAt");
