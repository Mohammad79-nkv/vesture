-- CreateTable
CREATE TABLE "SavedOutfit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "occasion" "Occasion",
    "totalPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT,
    "wearCount" INTEGER NOT NULL DEFAULT 0,
    "lastWornAt" TIMESTAMP(3),
    "compositeScore" INTEGER,
    "subScores" JSONB,
    "verdict" JSONB,
    "whatWorking" JSONB,
    "whatToTry" JSONB,
    "scoredAt" TIMESTAMP(3),
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedOutfit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedOutfitPiece" (
    "outfitId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,

    CONSTRAINT "SavedOutfitPiece_pkey" PRIMARY KEY ("outfitId","slot")
);

-- CreateIndex
CREATE INDEX "SavedOutfit_userId_createdAt_idx" ON "SavedOutfit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedOutfit_userId_lastWornAt_idx" ON "SavedOutfit"("userId", "lastWornAt");

-- CreateIndex
CREATE INDEX "SavedOutfit_userId_compositeScore_idx" ON "SavedOutfit"("userId", "compositeScore");

-- CreateIndex
CREATE INDEX "SavedOutfitPiece_pieceId_idx" ON "SavedOutfitPiece"("pieceId");

-- AddForeignKey
ALTER TABLE "SavedOutfit" ADD CONSTRAINT "SavedOutfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOutfitPiece" ADD CONSTRAINT "SavedOutfitPiece_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "SavedOutfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOutfitPiece" ADD CONSTRAINT "SavedOutfitPiece_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "ClosetPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;
