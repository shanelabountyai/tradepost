-- D-020: the listing form geocodes an address server-side instead of taking raw lat/lng. Nullable:
-- existing rows have no address on file, only the coordinates they were created with.
ALTER TABLE "Listing" ADD COLUMN "address" TEXT;
