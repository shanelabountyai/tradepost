-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "by" "Party" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_jobId_createdAt_idx" ON "Message"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (P0-7): a message is non-empty, and the thread is append-only (it can be dispute
-- evidence). TRUNCATE skips row triggers, so tests can still empty the table.
ALTER TABLE "Message" ADD CONSTRAINT "Message_body_check" CHECK (length("body") > 0);

CREATE FUNCTION message_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Message is append-only';
END;
$$;

CREATE TRIGGER "Message_append_only"
  BEFORE UPDATE OR DELETE ON "Message"
  FOR EACH ROW EXECUTE FUNCTION message_append_only();
