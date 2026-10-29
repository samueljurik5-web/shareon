-- MVP launch: no deposit (legacy columns default to 0), claim contact note, home page feedback.
-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('LIKE', 'BUG', 'FEATURE', 'TESTER');

-- AlterTable
ALTER TABLE "DamageReport" ADD COLUMN     "contactNote" TEXT;

-- AlterTable
ALTER TABLE "RentalRequest" ALTER COLUMN "depositCents" SET DEFAULT 0,
ALTER COLUMN "refundableCents" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "contact" TEXT,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

