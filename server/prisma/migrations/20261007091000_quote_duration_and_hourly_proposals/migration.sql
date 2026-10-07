-- Protection quotes record the rental mode and the exact duration (minutes for hourly rentals).
ALTER TABLE "ProtectionQuote"
  ADD COLUMN "rentalMode" "RentalMode" NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "durationMinutes" INTEGER,
  ALTER COLUMN "rentalDays" DROP NOT NULL;

-- Owners can propose a different time window for hourly rentals.
ALTER TABLE "RentalRequest"
  ADD COLUMN "proposedStartTime" TEXT,
  ADD COLUMN "proposedEndTime" TEXT;
