/**
 * Creates an admin account and a handful of clearly fictional demo profiles.
 * Run with `npm run db:seed`. Safe to re-run: existing phones are skipped.
 */
import { PrismaClient, type Gender } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEMO = [
  { name: "Demo Priya", gender: "FEMALE", dob: "1998-04-12", city: "Coimbatore", star: "Rohini", rasi: "Rishabam", education: "M.Sc. Mathematics", occupation: "Teacher", tongue: "Telugu" },
  { name: "Demo Kavya", gender: "FEMALE", dob: "1999-09-03", city: "Salem", star: "Hastham", rasi: "Kanni", education: "B.E. ECE", occupation: "Software engineer", tongue: "Kannada" },
  { name: "Demo Divya", gender: "FEMALE", dob: "1997-01-25", city: "Erode", star: "Revathi", rasi: "Meenam", education: "B.Com", occupation: "Accountant", tongue: "Telugu" },
  { name: "Demo Arun", gender: "MALE", dob: "1995-06-18", city: "Tiruppur", star: "Swathi", rasi: "Thulam", education: "B.Tech Textile", occupation: "Textile business", tongue: "Telugu" },
  { name: "Demo Karthik", gender: "MALE", dob: "1994-11-07", city: "Chennai", star: "Anusham", rasi: "Viruchigam", education: "MBA", occupation: "Bank officer", tongue: "Kannada" },
  { name: "Demo Vignesh", gender: "MALE", dob: "1996-03-30", city: "Bengaluru", star: "Moolam", rasi: "Dhanusu", education: "B.E. CSE", occupation: "Software engineer", tongue: "Telugu" },
] as const;

async function main() {
  const adminPhone = process.env.ADMIN_PHONE ?? "+919000000000";
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_PASSWORD when seeding a production database");
  }
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  await db.user.upsert({
    where: { phone: adminPhone },
    update: { role: "ADMIN" },
    create: { phone: adminPhone, passwordHash: await bcrypt.hash(adminPassword, 10), role: "ADMIN", phoneVerified: true },
  });
  console.log(`Admin: ${adminPhone} / ${process.env.ADMIN_PASSWORD ? "(from ADMIN_PASSWORD)" : adminPassword}`);

  const demoHash = await bcrypt.hash("demo12345", 10);
  for (const [i, d] of DEMO.entries()) {
    const phone = `+91900000010${i}`;
    if (await db.user.findUnique({ where: { phone } })) continue;
    await db.user.create({
      data: {
        phone,
        passwordHash: demoHash,
        phoneVerified: true,
        profile: {
          create: {
            code: `DM${90001 + i}`,
            profileFor: "SELF",
            name: d.name,
            gender: d.gender as Gender,
            dateOfBirth: new Date(d.dob),
            maritalStatus: "NEVER_MARRIED",
            heightCm: d.gender === "MALE" ? 172 : 158,
            motherTongue: d.tongue,
            star: d.star,
            rasi: d.rasi,
            education: d.education,
            occupation: d.occupation,
            city: d.city,
            about: "This is a demo profile for testing. It does not represent a real person.",
            prefMaritalStatus: ["NEVER_MARRIED"],
            status: "APPROVED",
          },
        },
      },
    });
  }
  console.log("Demo members: +919000000100 … +919000000105 / demo12345");

  await db.user.upsert({
    where: { phone: "+919000000001" },
    update: { role: "MODERATOR" },
    create: { phone: "+919000000001", passwordHash: await bcrypt.hash("moderator123", 10), role: "MODERATOR", phoneVerified: true },
  });
  console.log("Moderator: +919000000001 / moderator123");

  // Showcase badges: one premium member, one ID-verified member.
  const inSixMonths = new Date();
  inSixMonths.setMonth(inSixMonths.getMonth() + 6);
  await db.profile.updateMany({ where: { code: "DM90005", premiumUntil: null }, data: { premiumUntil: inSixMonths } });
  await db.profile.updateMany({ where: { code: { in: ["DM90002", "DM90005"] }, idVerifiedAt: null }, data: { idVerifiedAt: new Date() } });
}

main().finally(() => db.$disconnect());
