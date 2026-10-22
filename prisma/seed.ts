/**
 * Creates an admin account and a handful of clearly fictional demo profiles.
 * Run with `npm run db:seed`. Safe to re-run: existing phones are skipped.
 */
import { PrismaClient, type Gender } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { phoneFields, phoneHash } from "../src/lib/field-crypto-core";

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
    where: { phoneHash: phoneHash(adminPhone) },
    update: { role: "ADMIN" },
    create: { ...phoneFields(adminPhone), passwordHash: await bcrypt.hash(adminPassword, 10), role: "ADMIN", phoneVerified: true },
  });
  console.log(`Admin: ${adminPhone} / ${process.env.ADMIN_PASSWORD ? "(from ADMIN_PASSWORD)" : adminPassword}`);

  const demoHash = await bcrypt.hash("demo12345", 10);
  for (const [i, d] of DEMO.entries()) {
    const phone = `+91900000010${i}`;
    if (await db.user.findUnique({ where: { phoneHash: phoneHash(phone) } })) continue;
    await db.user.create({
      data: {
        ...phoneFields(phone),
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
    where: { phoneHash: phoneHash("+919000000001") },
    update: { role: "MODERATOR" },
    create: { ...phoneFields("+919000000001"), passwordHash: await bcrypt.hash("moderator123", 10), role: "MODERATOR", phoneVerified: true },
  });
  console.log("Moderator: +919000000001 / moderator123");

  // Showcase badges: one premium member, one ID-verified member.
  const inSixMonths = new Date();
  inSixMonths.setMonth(inSixMonths.getMonth() + 6);
  await db.profile.updateMany({ where: { code: "DM90005", premiumUntil: null }, data: { premiumUntil: inSixMonths } });
  await db.profile.updateMany({ where: { code: { in: ["DM90002", "DM90005"] }, idVerifiedAt: null }, data: { idVerifiedAt: new Date() } });

  if (process.env.NODE_ENV !== "production" || process.env.SEED_SHOWCASE === "true") await showcase(demoHash);
}

const FIRST = {
  FEMALE: ["Anitha", "Bhavana", "Deepa", "Gayathri", "Harini", "Indhu", "Janani", "Keerthana", "Lavanya", "Meena", "Nandhini", "Pavithra", "Ramya", "Sowmya", "Swetha", "Vidhya", "Yamini", "Sangeetha"],
  MALE: ["Ajith", "Bala", "Dinesh", "Ganesh", "Hari", "Karthi", "Lokesh", "Manoj", "Naveen", "Prakash", "Rajesh", "Saravanan", "Senthil", "Suresh", "Vasanth", "Venkat", "Yuvaraj", "Gokul"],
};
const CITIES = ["Coimbatore", "Tiruppur", "Erode", "Salem", "Chennai", "Madurai", "Bengaluru", "Hosur", "Komarapalayam", "Somanur", "Karur", "Namakkal"];
const JOBS = ["Software professional", "Teacher / Lecturer", "Textile & weaving business", "Banking & finance", "Engineer", "Doctor", "Government service", "Private company"];
const EDU = ["Bachelor's – Engineering", "Master's – Arts & Science", "MBA", "Bachelor's – Arts & Science", "Medicine (MBBS / MD)", "Diploma"];
const GOTHRAMS = ["Kashyapa", "Atreya", "Bharadwaja", "Markandeya", "Vasishta", "Kaundinya", "Gautama"];
const STARS = ["Ashwini", "Rohini", "Punarpoosam", "Magam", "Hastham", "Swathi", "Anusham", "Moolam", "Thiruvonam", "Revathi"];

/**
 * Fictional members spread over the last 30 days, plus interests, demo payments, a success story,
 * an event and an announcement, so the admin dashboard and public pages have something to show.
 * Skipped in production unless SEED_SHOWCASE=true. Idempotent per phone number.
 */
async function showcase(passwordHash: string) {
  const day = 24 * 60 * 60 * 1000;
  for (let i = 0; i < 40; i++) {
    const phone = `+9190000002${String(i).padStart(2, "0")}`;
    if (await db.user.findUnique({ where: { phoneHash: phoneHash(phone) } })) continue;
    const gender: Gender = i % 5 < 2 ? "FEMALE" : "MALE";
    const names = FIRST[gender];
    const joined = new Date(Date.now() - ((i * 7) % 30) * day - (i % 9) * 3600_000);
    // A few recent sign-ups stay in the review queue.
    const status = i % 11 === 3 ? "PENDING" : i === 17 ? "MARRIED" : "APPROVED";
    await db.user.create({
      data: {
        ...phoneFields(phone),
        passwordHash,
        phoneVerified: true,
        createdAt: joined,
        lastLoginAt: new Date(joined.getTime() + day),
        lastActiveAt: new Date(Date.now() - (i % 12) * day),
        profile: {
          create: {
            code: `DM${91001 + i}`,
            profileFor: i % 3 === 0 ? (gender === "MALE" ? "SON" : "DAUGHTER") : "SELF",
            name: `${names[i % names.length]} (demo)`,
            gender,
            dateOfBirth: new Date(1990 + (i % 10), i % 12, 1 + (i % 27)),
            maritalStatus: i % 13 === 5 ? "DIVORCED" : "NEVER_MARRIED",
            heightCm: gender === "MALE" ? 165 + (i % 15) : 150 + (i % 14),
            motherTongue: i % 4 === 0 ? "Kannada" : "Telugu",
            gothram: GOTHRAMS[i % GOTHRAMS.length],
            star: STARS[i % STARS.length],
            education: EDU[i % EDU.length],
            occupation: JOBS[i % JOBS.length],
            city: CITIES[(i * 5) % CITIES.length],
            about: "Demo profile for showcasing the site. It does not represent a real person.",
            prefMaritalStatus: ["NEVER_MARRIED"],
            status,
            marriedAt: status === "MARRIED" ? new Date(Date.now() - 10 * day) : null,
            createdAt: joined,
            premiumUntil: i % 6 === 0 ? new Date(Date.now() + 120 * day) : null,
          },
        },
      },
    });
  }
  // Payments and interests are re-created on every run (test clean-up scripts delete them).
  const profiles = await db.profile.findMany({
    where: { code: { gte: "DM91001", lte: "DM91040" } },
    select: { id: true, userId: true, gender: true, createdAt: true, premiumUntil: true },
    orderBy: { code: "asc" },
  });
  for (const p of profiles.filter((x) => x.premiumUntil)) {
    if (await db.payment.findFirst({ where: { profileId: p.id } })) continue;
    await db.payment.create({
      data: { profileId: p.id, paidById: p.userId, plan: "gold-6", months: 6, amount: 299900, status: "PAID", demo: true, createdAt: p.createdAt, paidAt: p.createdAt },
    });
  }
  // Interests between showcase members of opposite genders, spread over the month.
  const women = profiles.filter((p) => p.gender === "FEMALE");
  const men = profiles.filter((p) => p.gender === "MALE");
  for (const [i, m] of men.entries()) {
    for (const w of [women[i % women.length], women[(i + 3) % women.length]]) {
      if (!w) continue;
      const at = new Date(Math.max(m.createdAt.getTime(), w.createdAt.getTime()) + day);
      await db.interest.upsert({
        where: { fromId_toId: { fromId: m.id, toId: w.id } },
        update: {},
        create: { fromId: m.id, toId: w.id, status: i % 3 === 0 ? "ACCEPTED" : i % 3 === 1 ? "PENDING" : "DECLINED", createdAt: at > new Date() ? new Date() : at },
      });
    }
  }

  if (!(await db.successStory.count())) {
    await db.successStory.create({
      data: {
        coupleNames: "Demo couple — Lakshmi & Ravi",
        city: "Coimbatore",
        story: "A sample success story for the demo. Members can share their own from the Success stories page, and admins publish them.",
        weddingDate: new Date(Date.now() - 40 * day),
        published: true,
      },
    });
  }
  if (!(await db.event.count())) {
    await db.event.create({
      data: {
        title: "Devanga community meet (sample event)",
        description: "A sample event to show how community events appear. Admins add real events from the admin portal.",
        location: "Community hall, Coimbatore",
        startsAt: new Date(Date.now() + 21 * day),
      },
    });
  }
  if (!(await db.announcement.count())) {
    await db.announcement.create({
      data: { title: "Welcome to the demo", body: "This is a demonstration site. All profiles are fictional.", audience: "all" },
    });
  }
  if (!(await db.advertisement.count())) {
    const samples = [
      { advertiser: "Sample Studio", category: "PHOTOGRAPHER", title: "Candid wedding photography", tagline: "Sample advertisement — admins replace these in Admin → Advertisements", colors: ["#5e1229", "#8a6a3b"] },
      { advertiser: "Sample Mahal", category: "VENUE", title: "Wedding halls in Coimbatore and Erode", tagline: "Sample advertisement", colors: ["#3f0b1b", "#5e1229"] },
      { advertiser: "Sample Planners", category: "WEDDING_PLANNER", title: "Complete wedding planning", tagline: "Sample advertisement", colors: ["#8a6a3b", "#3f0b1b"] },
    ] as const;
    for (const [i, s] of samples.entries()) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${s.colors[0]}"/><stop offset="1" stop-color="${s.colors[1]}"/></linearGradient></defs><rect width="1600" height="600" fill="url(#g)"/><text x="120" y="300" font-family="Georgia, serif" font-size="64" fill="#f3ece0">${s.title}</text><text x="120" y="390" font-family="Arial, sans-serif" font-size="34" fill="#e9dcc3">${s.advertiser} · sample banner</text></svg>`;
      const image = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
      await db.advertisement.create({
        data: { advertiser: s.advertiser, category: s.category, title: s.title, tagline: s.tagline, href: "https://example.com", image: new Uint8Array(image), sortOrder: i },
      });
    }
  }
  console.log("Showcase data: 40 demo members (+919000000200 … 239 / demo12345), interests, payments, story, event, sample ads");
}

main().finally(() => db.$disconnect());
