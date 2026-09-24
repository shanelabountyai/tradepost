-- CreateTable
CREATE TABLE "Outbox" (
    "id" UUID NOT NULL,
    "orgId" UUID,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sendAfter" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Outbox_sentAt_sendAfter_idx" ON "Outbox"("sentAt", "sendAfter");

-- AddForeignKey
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

