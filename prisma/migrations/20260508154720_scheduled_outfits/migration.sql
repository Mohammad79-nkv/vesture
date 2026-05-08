-- CreateEnum
CREATE TYPE "TimeOfDay" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateTable
CREATE TABLE "ScheduledOutfit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedOutfitId" TEXT,
    "name" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "timeOfDay" "TimeOfDay" NOT NULL,
    "occasion" TEXT,
    "pieces" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledOutfit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledOutfit_userId_scheduledFor_idx" ON "ScheduledOutfit"("userId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "ScheduledOutfit" ADD CONSTRAINT "ScheduledOutfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
