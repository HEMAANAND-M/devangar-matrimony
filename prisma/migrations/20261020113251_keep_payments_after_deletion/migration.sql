-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_profileId_fkey";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "profileId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
