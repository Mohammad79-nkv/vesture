-- CreateEnum
CREATE TYPE "Formality" AS ENUM ('CASUAL', 'SMART_CASUAL', 'FORMAL');

-- CreateEnum
CREATE TYPE "PieceStatus" AS ENUM ('IN_CLOSET', 'LENT', 'CLEANER', 'STORAGE', 'DONATED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ClosetPiece" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT,
    "category" "Category" NOT NULL,
    "color" TEXT,
    "swatchHex" TEXT,
    "fabric" TEXT,
    "formality" "Formality",
    "season" "Season",
    "brand" TEXT,
    "notes" TEXT,
    "aiTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiConfidence" DOUBLE PRECISION,
    "wearCount" INTEGER NOT NULL DEFAULT 0,
    "lastWornAt" TIMESTAMP(3),
    "status" "PieceStatus" NOT NULL DEFAULT 'IN_CLOSET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosetPiece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClosetPiece_userId_status_idx" ON "ClosetPiece"("userId", "status");

-- CreateIndex
CREATE INDEX "ClosetPiece_userId_category_idx" ON "ClosetPiece"("userId", "category");

-- CreateIndex
CREATE INDEX "ClosetPiece_userId_lastWornAt_idx" ON "ClosetPiece"("userId", "lastWornAt");

-- AddForeignKey
ALTER TABLE "ClosetPiece" ADD CONSTRAINT "ClosetPiece_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
