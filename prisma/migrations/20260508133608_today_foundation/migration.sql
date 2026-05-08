-- AlterTable
ALTER TABLE "User" ADD COLUMN     "closetVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "location" JSONB;

-- CreateTable
CREATE TABLE "TodayRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateUtc" TEXT NOT NULL,
    "closetVersion" INTEGER NOT NULL,
    "tempBucket" INTEGER NOT NULL,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodayRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodayRecommendation_userId_dateUtc_idx" ON "TodayRecommendation"("userId", "dateUtc");

-- CreateIndex
CREATE UNIQUE INDEX "TodayRecommendation_userId_dateUtc_key" ON "TodayRecommendation"("userId", "dateUtc");

-- AddForeignKey
ALTER TABLE "TodayRecommendation" ADD CONSTRAINT "TodayRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
