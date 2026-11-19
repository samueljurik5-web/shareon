-- Short market survey (/dotaznik).
-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "boughtUnused" TEXT NOT NULL,
    "categories" TEXT[],
    "categoryOther" TEXT,
    "wouldBorrow" TEXT NOT NULL,
    "barriers" TEXT[],
    "noDepositHelps" TEXT NOT NULL,
    "wouldLend" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyResponse_createdAt_idx" ON "SurveyResponse"("createdAt");
