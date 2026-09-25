-- Hand-written: ranges the database enforces whatever the app does.
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_rateCents_check" CHECK ("rateCents" > 0),
ADD CONSTRAINT "Listing_radiusMiles_check" CHECK ("radiusMiles" > 0),
ADD CONSTRAINT "Listing_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
ADD CONSTRAINT "Listing_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
ADD CONSTRAINT "Listing_days_check" CHECK ("days" <@ ARRAY[0,1,2,3,4,5,6]);
ALTER TABLE "ProviderRating" ADD CONSTRAINT "ProviderRating_range_check" CHECK ("count" >= 0 AND "sum" BETWEEN "count" AND 5 * "count");
