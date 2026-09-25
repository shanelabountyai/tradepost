/*
  Warnings:

  - Added the required column `category` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lat` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lng` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `radiusMiles` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rateCents` to the `Listing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('plumbing', 'electrical', 'cleaning', 'painting', 'handyman', 'landscaping');

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_listingId_orgId_fkey";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "category" "ServiceCategory" NOT NULL,
ADD COLUMN     "days" INTEGER[],
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "lng" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "radiusMiles" INTEGER NOT NULL,
ADD COLUMN     "rateCents" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "ProviderRating" (
    "orgId" UUID NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "sum" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProviderRating_pkey" PRIMARY KEY ("orgId")
);

-- CreateIndex
CREATE INDEX "Listing_category_idx" ON "Listing"("category");

-- AddForeignKey
ALTER TABLE "ProviderRating" ADD CONSTRAINT "ProviderRating_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_listingId_orgId_fkey" FOREIGN KEY ("listingId", "orgId") REFERENCES "Listing"("id", "orgId") ON DELETE NO ACTION ON UPDATE CASCADE;
