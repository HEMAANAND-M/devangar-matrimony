-- Users are cleaned up by reset-users.mjs (phone numbers are encrypted, so SQL cannot match them).
DELETE FROM "RateLimit";
DELETE FROM "Payment" WHERE "profileId" IS NULL OR demo = true OR id LIKE 'pay_test%';
DELETE FROM "Block" b USING "Profile" p WHERE b."blockerId" = p.id AND p.code LIKE 'DM9000%';
DELETE FROM "Notification";
DELETE FROM "AdminLog";
DELETE FROM "Interest";
DELETE FROM "ProfileView";
DELETE FROM "Announcement" WHERE title <> 'Welcome to the demo';
DELETE FROM "Report";
DELETE FROM "SavedSearch";
DELETE FROM "Message";
DELETE FROM "ContactRequest";
DELETE FROM "SupportTicket";
DELETE FROM "Coupon" WHERE code LIKE 'TEST%';
DELETE FROM "IdVerification";
DELETE FROM "Event" WHERE title <> 'Devanga community meet (sample event)';
DELETE FROM "SuccessStory" WHERE "coupleNames" NOT LIKE 'Demo couple%';
DELETE FROM "Payment" WHERE offline = true;
DELETE FROM "Horoscope";
-- Restore the seeded demo state: only DM90005 is premium; only DM90002 and DM90005 are ID-verified.
UPDATE "Profile" SET "premiumUntil" = NULL WHERE code IN ('DM90001','DM90002','DM90003','DM90004','DM90006');
UPDATE "Profile" SET "photoVerifiedAt" = NULL, flags = '{}', "staffNotes" = NULL WHERE code LIKE 'DM9000%';
UPDATE "Profile" SET "idVerifiedAt" = NULL WHERE code IN ('DM90001','DM90003','DM90004','DM90006');
UPDATE "Profile" SET status = 'APPROVED', "rejectionReason" = NULL WHERE code LIKE 'DM9000%';
DELETE FROM "SecurityEvent";
DELETE FROM "Advertisement"; DELETE FROM "Campaign";
