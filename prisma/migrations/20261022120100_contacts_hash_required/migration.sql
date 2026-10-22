-- Stops with instructions if contact details have not been encrypted yet (see CHANGELOG 1.8.0).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "phoneHash" IS NULL) OR EXISTS (SELECT 1 FROM "FamilyInvite" WHERE "phoneHash" IS NULL) THEN
    RAISE EXCEPTION 'Contact details are not encrypted yet. Run "npm run db:encrypt-contacts", then "npx prisma migrate resolve --rolled-back 20261022120100_contacts_hash_required", then "npx prisma migrate deploy" again.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "FamilyInvite" ALTER COLUMN "phoneHash" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "phoneHash" SET NOT NULL;
