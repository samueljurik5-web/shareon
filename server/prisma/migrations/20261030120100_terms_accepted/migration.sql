-- Consent record: terms accepted + privacy notice acknowledged at registration.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

