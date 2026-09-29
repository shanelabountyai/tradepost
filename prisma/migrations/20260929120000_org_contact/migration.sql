-- D-021: a provider's SMS contact number, one row per org.
CREATE TABLE "OrgContact" (
    "orgId" UUID NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "OrgContact_pkey" PRIMARY KEY ("orgId")
);

ALTER TABLE "OrgContact" ADD CONSTRAINT "OrgContact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
