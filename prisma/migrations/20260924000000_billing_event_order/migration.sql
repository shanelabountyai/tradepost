-- AlterTable: the Stripe `event.created` last applied, so an older event delivered late cannot overwrite a newer state (INV-12)
ALTER TABLE "BillingAccount" ADD COLUMN "stripeEventAt" TIMESTAMPTZ(6);
