-- ShareOn: daily + hourly rental modes.
-- Hand-written to PRESERVE data (renames instead of drop/add) and to convert existing
-- daily rentals to the inclusive day rule (12.–14. = 3 days).

-- Enums
CREATE TYPE "RentalMode" AS ENUM ('DAILY', 'HOURLY');
ALTER TYPE "ReportType" ADD VALUE 'LATE_RETURN';

-- ───────────── Item ─────────────
ALTER TABLE "Item" RENAME COLUMN "pricePerDayCents" TO "dailyPriceCents";
ALTER TABLE "Item" ALTER COLUMN "dailyPriceCents" DROP NOT NULL;
ALTER INDEX "Item_pricePerDayCents_idx" RENAME TO "Item_dailyPriceCents_idx";

ALTER TABLE "Item"
  ADD COLUMN "hourlyPriceCents" INTEGER,
  ADD COLUMN "dailyRentalEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "hourlyRentalEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minRentalHours" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "maxRentalHours" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "minRentalDays" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "maxRentalDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "availableFromTime" TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN "availableToTime" TEXT NOT NULL DEFAULT '20:00',
  ADD COLUMN "bufferHours" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Item_hourlyRentalEnabled_dailyRentalEnabled_idx" ON "Item"("hourlyRentalEnabled", "dailyRentalEnabled");

-- Integrity rules (also validated in the API with Slovak messages)
ALTER TABLE "Item"
  ADD CONSTRAINT "Item_some_mode_enabled" CHECK ("dailyRentalEnabled" OR "hourlyRentalEnabled"),
  ADD CONSTRAINT "Item_daily_price_required" CHECK (NOT "dailyRentalEnabled" OR ("dailyPriceCents" IS NOT NULL AND "dailyPriceCents" > 0)),
  ADD CONSTRAINT "Item_hourly_price_required" CHECK (NOT "hourlyRentalEnabled" OR ("hourlyPriceCents" IS NOT NULL AND "hourlyPriceCents" > 0)),
  ADD CONSTRAINT "Item_hours_range" CHECK ("minRentalHours" >= 1 AND "maxRentalHours" >= "minRentalHours" AND "maxRentalHours" <= 24),
  ADD CONSTRAINT "Item_days_range" CHECK ("minRentalDays" >= 1 AND "maxRentalDays" >= "minRentalDays" AND "maxRentalDays" <= 90),
  ADD CONSTRAINT "Item_time_format" CHECK ("availableFromTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "availableToTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "Item_time_order" CHECK ("availableFromTime" < "availableToTime"),
  ADD CONSTRAINT "Item_buffer_range" CHECK ("bufferHours" >= 0 AND "bufferHours" <= 72);

-- ───────────── RentalRequest ─────────────
ALTER TABLE "RentalRequest" RENAME COLUMN "pricePerDayCents" TO "pricePerUnitCents";
ALTER TABLE "RentalRequest" RENAME COLUMN "rentalDays" TO "durationDays";
ALTER TABLE "RentalRequest" ALTER COLUMN "durationDays" DROP NOT NULL;

ALTER TABLE "RentalRequest"
  ADD COLUMN "rentalMode" "RentalMode" NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT,
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "refundableCents" INTEGER,
  ADD COLUMN "startAt" TIMESTAMP(3),
  ADD COLUMN "endAt" TIMESTAMP(3);

-- Old rule: days = end − start (return on endDate). New rule: both dates included.
-- Shift endDate back one day so the stored day count stays identical.
UPDATE "RentalRequest" SET "endDate" = "endDate" - 1 WHERE "endDate" > "startDate";
UPDATE "RentalRequest" SET "proposedEndDate" = "proposedEndDate" - 1
  WHERE "proposedEndDate" IS NOT NULL AND "proposedEndDate" > "proposedStartDate";

-- Exact UTC interval: local midnight of startDate → local midnight after endDate.
UPDATE "RentalRequest" SET
  "startAt" = ("startDate"::timestamp AT TIME ZONE 'Europe/Bratislava') AT TIME ZONE 'UTC',
  "endAt" = (("endDate" + 1)::timestamp AT TIME ZONE 'Europe/Bratislava') AT TIME ZONE 'UTC',
  "refundableCents" = "depositCents";

ALTER TABLE "RentalRequest"
  ALTER COLUMN "startAt" SET NOT NULL,
  ALTER COLUMN "endAt" SET NOT NULL,
  ALTER COLUMN "refundableCents" SET NOT NULL;

DROP INDEX "RentalRequest_startDate_endDate_idx";
CREATE INDEX "RentalRequest_itemId_startAt_endAt_idx" ON "RentalRequest"("itemId", "startAt", "endAt");
CREATE INDEX "RentalRequest_rentalMode_idx" ON "RentalRequest"("rentalMode");

ALTER TABLE "RentalRequest"
  ADD CONSTRAINT "RentalRequest_interval_order" CHECK ("startAt" < "endAt"),
  ADD CONSTRAINT "RentalRequest_dates_order" CHECK ("startDate" <= "endDate"),
  ADD CONSTRAINT "RentalRequest_hourly_shape" CHECK (
    "rentalMode" <> 'HOURLY' OR (
      "startDate" = "endDate" AND "startTime" IS NOT NULL AND "endTime" IS NOT NULL
      AND "startTime" < "endTime" AND "durationMinutes" IS NOT NULL AND "durationMinutes" > 0
    )
  ),
  ADD CONSTRAINT "RentalRequest_daily_shape" CHECK (
    "rentalMode" <> 'DAILY' OR ("durationDays" IS NOT NULL AND "durationDays" >= 1)
  ),
  ADD CONSTRAINT "RentalRequest_amounts_non_negative" CHECK (
    "rentalPriceCents" >= 0 AND "protectionFeeCents" >= 0 AND "depositCents" >= 0
    AND "platformFeeCents" >= 0 AND "totalCents" >= 0 AND "refundableCents" >= 0
  );
