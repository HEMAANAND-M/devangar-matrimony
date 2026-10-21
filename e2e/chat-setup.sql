-- Accepted interests for the chat suite: DM90005 (premium) <-> DM90001, DM90004 (free) <-> DM90002 (free).
DELETE FROM "Interest" WHERE ("fromId", "toId") IN (
  SELECT a.id, b.id FROM "Profile" a, "Profile" b
  WHERE (a.code, b.code) IN (('DM90005','DM90001'),('DM90001','DM90005'),('DM90004','DM90002'),('DM90002','DM90004')));
INSERT INTO "Interest"(id, "fromId", "toId", status, "createdAt", "updatedAt")
SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), a.id, b.id, 'ACCEPTED', now(), now()
FROM "Profile" a, "Profile" b WHERE (a.code, b.code) IN (('DM90005','DM90001'),('DM90004','DM90002'));
