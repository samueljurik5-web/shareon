-- New categories for the home page quick filters (Technika, Domácnosť).
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'ELECTRONICS';
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'HOUSEHOLD';

-- Optional Košice city district of an item (never an address) – used for approximate distance.
ALTER TABLE "Item" ADD COLUMN "district" TEXT;
