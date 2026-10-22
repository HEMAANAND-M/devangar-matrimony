-- DropIndex
DROP INDEX "FamilyInvite_phone_idx";

-- DropIndex
DROP INDEX "FamilyInvite_profileId_phone_key";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_phone_key";

-- AlterTable
ALTER TABLE "FamilyInvite" ADD COLUMN     "phoneHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailHash" TEXT,
ADD COLUMN     "phoneHash" TEXT;

-- CreateIndex
CREATE INDEX "FamilyInvite_phoneHash_idx" ON "FamilyInvite"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_profileId_phoneHash_key" ON "FamilyInvite"("profileId", "phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");

