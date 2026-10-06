-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('NEW', 'VERY_GOOD', 'GOOD', 'USED', 'WORN');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'RETURN_PENDING', 'RETURNED', 'DISPUTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HandoverMethod" AS ENUM ('PERSONAL_PICKUP', 'OWNER_DELIVERY', 'MEET_ELSEWHERE');

-- CreateEnum
CREATE TYPE "HandoverType" AS ENUM ('HANDOVER', 'RETURN');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('OWNER', 'RENTER');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('RENTER_TO_OWNER', 'OWNER_TO_RENTER');

-- CreateEnum
CREATE TYPE "ProtectionMode" AS ENUM ('NONE', 'PROTECTION_FEE', 'INSURANCE');

-- CreateEnum
CREATE TYPE "ProtectionStatus" AS ENUM ('QUOTED', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'CLAIM_UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'HELD', 'RELEASE_REQUESTED', 'RELEASED', 'PARTIALLY_WITHHELD', 'WITHHELD', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('ITEM_DAMAGED', 'ITEM_NOT_RETURNED', 'ITEM_DIFFERENT_THAN_DESCRIPTION', 'USER_BEHAVIOR', 'PAYMENT_PROBLEM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('EVIDENCE', 'RESPONSE', 'ADMIN_NOTE_PUBLIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "description" TEXT NOT NULL,
    "pricePerDayCents" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "condition" "ItemCondition" NOT NULL,
    "availableFrom" DATE NOT NULL,
    "availableTo" DATE NOT NULL,
    "replacementValueCents" INTEGER NOT NULL,
    "serialNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "protectionEligible" BOOLEAN NOT NULL DEFAULT true,
    "declarationsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemImage" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalRequest" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "rentalDays" INTEGER NOT NULL,
    "message" TEXT,
    "handoverMethod" "HandoverMethod" NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'PENDING',
    "pricePerDayCents" INTEGER NOT NULL,
    "rentalPriceCents" INTEGER NOT NULL,
    "protectionFeeCents" INTEGER NOT NULL,
    "depositCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "protectionMode" "ProtectionMode" NOT NULL,
    "rulesAcceptedAt" TIMESTAMP(3) NOT NULL,
    "protectionDisclaimerAcceptedAt" TIMESTAMP(3),
    "proposedStartDate" DATE,
    "proposedEndDate" DATE,
    "ownerNote" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "activeAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rentalRequestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "ReviewType" NOT NULL,
    "overall" INTEGER NOT NULL,
    "comment" TEXT,
    "punctuality" INTEGER,
    "communication" INTEGER,
    "reliability" INTEGER,
    "respectfulUse" INTEGER,
    "onTimeReturn" INTEGER,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemReview" (
    "id" TEXT NOT NULL,
    "rentalRequestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "descriptionAccuracy" INTEGER NOT NULL,
    "itemCondition" INTEGER NOT NULL,
    "valueForMoney" INTEGER NOT NULL,
    "handoverExperience" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "comment" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectionQuote" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "rentalRequestId" TEXT,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "mode" "ProtectionMode" NOT NULL,
    "isDemo" BOOLEAN NOT NULL,
    "replacementValueCents" INTEGER NOT NULL,
    "protectedValueCents" INTEGER NOT NULL,
    "rentalDays" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "inputs" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectionRecord" (
    "id" TEXT NOT NULL,
    "rentalRequestId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" "ProtectionMode" NOT NULL,
    "status" "ProtectionStatus" NOT NULL,
    "isDemo" BOOLEAN NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "protectedValueCents" INTEGER NOT NULL,
    "externalReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "rentalRequestId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "withheldCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "DepositStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "idempotencyKey" TEXT NOT NULL,
    "heldAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverRecord" (
    "id" TEXT NOT NULL,
    "rentalRequestId" TEXT NOT NULL,
    "type" "HandoverType" NOT NULL,
    "userId" TEXT NOT NULL,
    "partyRole" "PartyRole" NOT NULL,
    "note" TEXT,
    "itemOk" BOOLEAN,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverPhoto" (
    "id" TEXT NOT NULL,
    "handoverRecordId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageReport" (
    "id" TEXT NOT NULL,
    "rentalRequestId" TEXT,
    "itemId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "type" "ReportType" NOT NULL,
    "description" TEXT NOT NULL,
    "requestedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "approvedAmountCents" INTEGER,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DamageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportEvidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "text" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminDecision" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "decision" "ReportStatus" NOT NULL,
    "approvedAmountCents" INTEGER,
    "publicNote" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_city_idx" ON "User"("city");

-- CreateIndex
CREATE INDEX "Item_ownerId_idx" ON "Item"("ownerId");

-- CreateIndex
CREATE INDEX "Item_category_isActive_idx" ON "Item"("category", "isActive");

-- CreateIndex
CREATE INDEX "Item_city_idx" ON "Item"("city");

-- CreateIndex
CREATE INDEX "Item_createdAt_idx" ON "Item"("createdAt");

-- CreateIndex
CREATE INDEX "Item_pricePerDayCents_idx" ON "Item"("pricePerDayCents");

-- CreateIndex
CREATE INDEX "ItemImage_itemId_position_idx" ON "ItemImage"("itemId", "position");

-- CreateIndex
CREATE INDEX "RentalRequest_itemId_status_idx" ON "RentalRequest"("itemId", "status");

-- CreateIndex
CREATE INDEX "RentalRequest_renterId_status_idx" ON "RentalRequest"("renterId", "status");

-- CreateIndex
CREATE INDEX "RentalRequest_ownerId_status_idx" ON "RentalRequest"("ownerId", "status");

-- CreateIndex
CREATE INDEX "RentalRequest_startDate_endDate_idx" ON "RentalRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Review_targetId_isHidden_idx" ON "Review"("targetId", "isHidden");

-- CreateIndex
CREATE UNIQUE INDEX "Review_rentalRequestId_type_key" ON "Review"("rentalRequestId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ItemReview_rentalRequestId_key" ON "ItemReview"("rentalRequestId");

-- CreateIndex
CREATE INDEX "ItemReview_itemId_isHidden_idx" ON "ItemReview"("itemId", "isHidden");

-- CreateIndex
CREATE INDEX "ProtectionQuote_rentalRequestId_idx" ON "ProtectionQuote"("rentalRequestId");

-- CreateIndex
CREATE INDEX "ProtectionQuote_itemId_idx" ON "ProtectionQuote"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionRecord_rentalRequestId_key" ON "ProtectionRecord"("rentalRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionRecord_idempotencyKey_key" ON "ProtectionRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProtectionRecord_status_idx" ON "ProtectionRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_rentalRequestId_key" ON "Deposit"("rentalRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_idempotencyKey_key" ON "Deposit"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverRecord_rentalRequestId_type_partyRole_key" ON "HandoverRecord"("rentalRequestId", "type", "partyRole");

-- CreateIndex
CREATE INDEX "DamageReport_status_idx" ON "DamageReport"("status");

-- CreateIndex
CREATE INDEX "DamageReport_rentalRequestId_idx" ON "DamageReport"("rentalRequestId");

-- CreateIndex
CREATE INDEX "DamageReport_reporterId_idx" ON "DamageReport"("reporterId");

-- CreateIndex
CREATE INDEX "ReportEvidence_reportId_createdAt_idx" ON "ReportEvidence"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminDecision_reportId_idx" ON "AdminDecision"("reportId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_itemId_key" ON "Favorite"("userId", "itemId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemImage" ADD CONSTRAINT "ItemImage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRequest" ADD CONSTRAINT "RentalRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRequest" ADD CONSTRAINT "RentalRequest_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRequest" ADD CONSTRAINT "RentalRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReview" ADD CONSTRAINT "ItemReview_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReview" ADD CONSTRAINT "ItemReview_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReview" ADD CONSTRAINT "ItemReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionQuote" ADD CONSTRAINT "ProtectionQuote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionQuote" ADD CONSTRAINT "ProtectionQuote_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionQuote" ADD CONSTRAINT "ProtectionQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionRecord" ADD CONSTRAINT "ProtectionRecord_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverRecord" ADD CONSTRAINT "HandoverRecord_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverRecord" ADD CONSTRAINT "HandoverRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverPhoto" ADD CONSTRAINT "HandoverPhoto_handoverRecordId_fkey" FOREIGN KEY ("handoverRecordId") REFERENCES "HandoverRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEvidence" ADD CONSTRAINT "ReportEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DamageReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEvidence" ADD CONSTRAINT "ReportEvidence_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminDecision" ADD CONSTRAINT "AdminDecision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DamageReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminDecision" ADD CONSTRAINT "AdminDecision_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
